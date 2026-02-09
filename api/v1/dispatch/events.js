import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

function buildAddressString(locationJson) {
  if (!locationJson) {
    return '';
  }

  const address = locationJson?.address || locationJson;
  if (!address || typeof address !== 'object') {
    return '';
  }

  const parts = [
    address.Building_House_Number,
    address.Street,
    address.State_Province_Town_City,
    address.landmark,
  ].filter(Boolean);

  return parts.join(' ').trim();
}

async function geocodeAddress(addressString) {
  const geocodingApiKey =
    process.env.GOOGLE_GEOCODING_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    '';

  if (!geocodingApiKey) {
    console.warn('[dispatch webhook] Missing Google Geocoding API key');
    return null;
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressString)}&key=${geocodingApiKey}`
    );
    if (!response.ok) {
      console.warn('[dispatch webhook] Geocoding request failed', response.status);
      return null;
    }

    const data = await response.json();
    if (data.status !== 'OK' || !data.results?.length) {
      console.warn('[dispatch webhook] Geocoding returned no results', data.status);
      return null;
    }

    const best = data.results[0];
    const location = best.geometry?.location;
    if (!location) {
      console.warn('[dispatch webhook] Geocoding missing location geometry');
      return null;
    }

    return {
      lat: location.lat,
      lng: location.lng,
      formatted_address: best.formatted_address,
    };
  } catch (error) {
    console.error('[dispatch webhook] Geocoding API error:', error);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const body = req.body || {};

  if (typeof body.location_json === 'string') {
    try {
      body.location_json = JSON.parse(body.location_json);
    } catch {
      return res.status(422).json({ ok: false, error: 'location_json must be JSON' });
    }
  }

  const addressString = buildAddressString(body.location_json);
  let locationPin = null;

  if (addressString) {
    locationPin = await geocodeAddress(addressString);
  } else {
    console.warn('[dispatch webhook] No location_json provided, skipping geocode');
  }

  if (locationPin) {
    if (!supabase) {
      console.warn('[dispatch webhook] Supabase not configured for updates');
    } else if (!body.incident_id) {
      console.warn('[dispatch webhook] Missing incident_id, cannot update Supabase');
    } else {
      const { error } = await supabase
        .from('calls')
        .update({
          location_lat: locationPin.lat,
          location_lon: locationPin.lng,
          location_text: locationPin.formatted_address,
        })
        .eq('call_id', body.incident_id);

      if (error) {
        console.error('[dispatch webhook] Supabase update failed', error);
      } else {
        console.log('[dispatch webhook] Supabase updated call location', body.incident_id);
      }
    }
  }

  return res.status(200).json({ ok: true, event_received: true });
}
