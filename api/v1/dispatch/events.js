import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';
const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

function buildAddressString(locationJson, approximateLocation) {
  if (!locationJson && !approximateLocation) {
    return '';
  }

  const address = locationJson?.address || locationJson || {};

  const parts = [
    address.Building_House_Number,
    address.Street,
    address.State_Province_Town_City,
    address.landmark,
  ].filter(Boolean);

  // If we have an approximate location and it's not already represented in the address components,
  // add it to help Google Geocoding API narrow down the search
  if (approximateLocation && typeof approximateLocation === 'string') {
    const approxLower = approximateLocation.toLowerCase();
    const alreadyIncluded = parts.some(p => {
      const pStr = String(p).toLowerCase();
      return pStr.includes(approxLower) || approxLower.includes(pStr);
    });

    if (!alreadyIncluded) {
      parts.push(approximateLocation);
    }
  }

  return parts.join(', ').trim();
}

async function searchLocation(addressString) {
  const apiKey =
    process.env.GOOGLE_GEOCODING_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    '';

  if (!apiKey) {
    console.warn('[dispatch webhook] Missing Google API key');
    return null;
  }

  try {
    // 1. Try Geocoding API first (best for structured addresses)
    const geoResponse = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressString)}&key=${apiKey}`
    );
    const geoData = await geoResponse.json();

    if (geoData.status === 'OK' && geoData.results?.length) {
      const best = geoData.results[0];
      return {
        lat: best.geometry.location.lat,
        lng: best.geometry.location.lng,
        formatted_address: best.formatted_address,
      };
    }

    // 2. Fallback to Places Text Search (better for landmarks/descriptions)
    const placesResponse = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(addressString)}&key=${apiKey}`
    );
    const placesData = await placesResponse.json();

    if (placesData.status === 'OK' && placesData.results?.length) {
      const best = placesData.results[0];
      return {
        lat: best.geometry.location.lat,
        lng: best.geometry.location.lng,
        formatted_address: best.formatted_address || best.name,
      };
    }

    return null;
  } catch (error) {
    console.error('[dispatch webhook] Map search API error:', error);
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

  const addressString = body.location_text || buildAddressString(body.location_json, body.approximate_location);
  let locationPin = null;

  if (addressString) {
    locationPin = await searchLocation(addressString);
  } else {
    console.warn('[dispatch webhook] No location info provided, skipping geocode');
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
          location_text: locationPin.formatted_address || addressString,
        })
        .eq('call_id', body.incident_id);

      if (error) {
        console.error('[dispatch webhook] Supabase update failed', error);
      } else {
        console.log('[dispatch webhook] Supabase updated call location', body.incident_id);
      }
    }
  } else if (body.location_text && body.incident_id && supabase) {
    // Still update the text description even if geocoding failed
    await supabase
      .from('calls')
      .update({ location_text: body.location_text })
      .eq('call_id', body.incident_id);
  }

  return res.status(200).json({ ok: true, event_received: true });
}
