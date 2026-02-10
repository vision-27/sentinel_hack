import { supabase } from '../lib/supabase';
import { logExternalCall } from '../lib/logger';

export interface EmergencyCallParams {
  caller_name?: string;
  caller_phone?: string;
  incident_type?: string;
  location_text?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  medical_emergency?: boolean;
  number_of_victims?: number;
  weapons_present?: 'yes' | 'no' | 'unknown';
  impact_category?: 'None' | 'Low' | 'Medium' | 'High';
  summary?: string;
  notes?: string;
}

export const incidentService = {
  async searchLocation(text: string) {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn('[incidentService] Missing Google Maps API key');
      return null;
    }

    try {
      // 1. Try Geocoding API first
      const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(text)}&key=${apiKey}`;
      logExternalCall('Google Maps', 'GET', 'Geocoding API', { address: text });
      const geoRes = await fetch(geoUrl);
      const geoData = await geoRes.json();

      if (geoData.status === 'OK' && geoData.results?.length > 0) {
        const best = geoData.results[0];
        return {
          lat: best.geometry.location.lat,
          lng: best.geometry.location.lng,
          formatted_address: best.formatted_address
        };
      }

      // 2. Fallback to Places API Text Search
      const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(text)}&key=${apiKey}`;
      logExternalCall('Google Maps', 'GET', 'Places API', { query: text });
      const placesRes = await fetch(placesUrl);
      const placesData = await placesRes.json();

      if (placesData.status === 'OK' && placesData.results?.length > 0) {
        const best = placesData.results[0];
        return {
          lat: best.geometry.location.lat,
          lng: best.geometry.location.lng,
          formatted_address: best.formatted_address || best.name
        };
      }
    } catch (err) {
      console.error('[incidentService] searchLocation error:', err);
    }
    return null;
  },

  async createOrUpdateEmergencyCall(callId: string | null, params: EmergencyCallParams) {
    try {
      console.log('[incidentService] Processing emergency call details:', params);

      // Clean undefined values for update
      const updateData: any = {};
      if (params.caller_name) updateData.caller_name = params.caller_name;
      if (params.caller_phone) updateData.caller_phone = params.caller_phone;
      if (params.incident_type) updateData.incident_type = params.incident_type;

      if (params.location_text) {
        updateData.location_text = params.location_text;

        // AUTO-SEARCH: Geocode the location text to get coordinates
        const locationPin = await incidentService.searchLocation(params.location_text);
        if (locationPin) {
          updateData.location_lat = locationPin.lat;
          updateData.location_lon = locationPin.lng;
          // Use formatted address if available, otherwise keep original text
          if (locationPin.formatted_address) {
            updateData.location_text = locationPin.formatted_address;
          }
        }
      }
      if (params.priority) {
        // Normalize priority to lowercase to match database constraint
        const normalizedPriority = params.priority.toLowerCase();
        if (['low', 'medium', 'high', 'critical'].includes(normalizedPriority)) {
          updateData.priority = normalizedPriority;
        } else {
          console.warn(`[incidentService] Invalid priority value: ${params.priority}, defaulting to medium`);
          updateData.priority = 'medium';
        }
      }
      if (params.medical_emergency !== undefined) updateData.medical_emergency = params.medical_emergency;
      if (params.number_of_victims !== undefined) updateData.number_of_victims = params.number_of_victims;
      if (params.weapons_present) {
        // Normalize weapons_present
        const normalizedWeapons = params.weapons_present.toLowerCase();
        if (['yes', 'no', 'unknown'].includes(normalizedWeapons)) {
          updateData.weapons_present = normalizedWeapons;
        }
      }
      if (params.impact_category) {
        // Normalize impact_category (None, Low, Medium, High)
        const val = params.impact_category.toLowerCase();
        const normalizedImpact = val.charAt(0).toUpperCase() + val.slice(1);
        if (['None', 'Low', 'Medium', 'High'].includes(normalizedImpact)) {
          updateData.impact_category = normalizedImpact;
        } else {
          console.warn(`[incidentService] Invalid impact_category: ${params.impact_category}`);
        }
      }
      if (params.summary) updateData.notes = params.summary;
      if (params.notes) updateData.notes = params.notes;

      // Always update confidence if we are getting data from Sentinel
      updateData.ai_confidence_avg = 0.85;

      let result;

      if (callId) {
        // Update existing record with ONLY provided fields
        console.log(`[incidentService] Updating existing call ${callId} with`, updateData);

        if (Object.keys(updateData).length === 0) {
          return { success: true, message: 'No fields to update' };
        }

        logExternalCall('Supabase', 'update', 'calls', { id: callId, ...updateData });
        const { data, error } = await supabase
          .from('calls')
          .update(updateData)
          .eq('id', callId)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Create new record - need defaults for required DB fields
        console.log('[incidentService] Creating new call (fallback)');
        const newCallId = `CALL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const insertData = {
          call_id: newCallId,
          caller_name: params.caller_name || 'Anonymous',
          incident_type: params.incident_type || 'Unknown',
          location_text: params.location_text || 'Identifying...',
          priority: params.priority || 'medium',
          medical_emergency: params.medical_emergency || false,
          number_of_victims: params.number_of_victims || 0,
          weapons_present: params.weapons_present || 'unknown',
          impact_category: params.impact_category || 'None',
          status: 'ai_handling',
          source_type: 'web_voice',
          started_at: new Date().toISOString(),
          ...updateData // Override defaults with provided data
        };

        logExternalCall('Supabase', 'insert', 'calls', insertData);
        const { data, error } = await supabase
          .from('calls')
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      // Also update extracted_fields table to track history of AI extraction
      if (result?.id) {
        const fieldsToSkip = ['ai_confidence_avg'];
        const updates = Object.entries(updateData)
          .filter(([key]) => !fieldsToSkip.includes(key))
          .map(([key, value]) =>
            incidentService.updateIncidentData(result.id, key, String(value), 0.85)
          );

        await Promise.all(updates);
      }

      return { success: true, call: result };
    } catch (err) {
      console.error('[incidentService] Error:', err);
      return { success: false, error: err };
    }
  },

  async updateIncidentData(callId: string, fieldName: string, value: string, confidence: number) {
    try {
      console.log(`[incidentService] Updating field ${fieldName} for call ${callId}`);

      logExternalCall('Supabase', 'upsert', 'extracted_fields', { call_id: callId, field_name: fieldName, field_value: value });
      const { error: fieldError } = await supabase
        .from('extracted_fields')
        .upsert({
          call_id: callId,
          field_name: fieldName,
          field_value: value,
          confidence,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'call_id,field_name'
        });

      if (fieldError) throw fieldError;

      // Optionally update main call record for specific fields
      if (['location', 'location_text'].includes(fieldName)) {
        logExternalCall('Supabase', 'update', 'calls (text)', { id: callId, location_text: value });
        await supabase
          .from('calls')
          .update({ location_text: value })
          .eq('id', callId);
      }

      return { success: true };
    } catch (err) {
      console.error('[incidentService] Error updating incident data:', err);
      return { success: false, error: err };
    }
  }
};
