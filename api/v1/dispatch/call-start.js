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

export default async function handler(req, res) {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Idempotency-Key, Idempotency-Key, Authorization, Accept');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    const body = req.body || {};
    const incidentId = body.incident_id;

    if (!incidentId) {
      return res.status(422).json({ ok: false, error: 'Missing incident_id' });
    }

    const cacheKey = `call-start:${incidentId}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json({ ok: true, duplicate: true });
    }

    if (!supabase) {
      console.warn('[dispatch call-start] Supabase not configured for updates');
      return res.status(500).json({ ok: false, error: 'Supabase not configured' });
    }

    const insertData = {
      call_id: incidentId,
      status: 'ai_handling',
      incident_type: body.incident_type || 'Incoming Call...',
      location_text: body.location_text || 'Identifying...',
      source_type: 'web_voice',
      started_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('calls')
      .upsert(insertData, { onConflict: 'call_id' })
      .select()
      .single();

    if (error) {
      console.error('[dispatch call-start] Supabase upsert failed', error);
      return res.status(500).json({ ok: false, error: 'Supabase upsert failed', details: error.message });
    }

    await setCache(cacheKey, true, 3600);
    console.log('[dispatch call-start] call created/updated', data?.call_id);

    return res.status(200).json({ ok: true, call: data });
  } catch (error) {
    console.error('[dispatch call-start] CRITICAL ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: 'Internal Server Error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

async function getCache(key) {
  return null;
}

async function setCache(key, value, ttl) {
}
