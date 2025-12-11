-- ============================================================================
-- First Responder Emergency Dashboard - Complete Database Setup
-- This script creates all tables, indexes, triggers, RLS policies, and seed data
-- PostgreSQL / Supabase compatible
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SCHEMA CREATION
-- ============================================================================

-- Responders table - First responders and dispatchers
CREATE TABLE IF NOT EXISTS responders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('dispatcher', 'supervisor', 'admin')),
  phone TEXT,
  jurisdiction_id TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calls table - Main emergency call records
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ai_handling' CHECK (status IN ('ai_handling', 'human_active', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  caller_phone TEXT,
  caller_name TEXT,
  source_type TEXT NOT NULL DEFAULT 'phone',
  incident_type TEXT,
  location_text TEXT,
  location_lat DOUBLE PRECISION,
  location_lon DOUBLE PRECISION,
  location_accuracy TEXT DEFAULT 'approximate' CHECK (location_accuracy IN ('exact', 'approximate', 'gps_only')),
  impact_category TEXT DEFAULT 'None' CHECK (impact_category IN ('None', 'Low', 'Medium', 'High')),
  ai_confidence_avg DOUBLE PRECISION DEFAULT 0.0 CHECK (ai_confidence_avg >= 0.0 AND ai_confidence_avg <= 1.0),
  assigned_responder_id UUID REFERENCES responders(id) ON DELETE SET NULL,
  number_of_victims INTEGER DEFAULT 0,
  weapons_present TEXT DEFAULT 'unknown' CHECK (weapons_present IN ('yes', 'no', 'unknown')),
  medical_emergency BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  recording_url TEXT,
  notes TEXT
);

-- Transcript blocks table - Live call transcripts
CREATE TABLE IF NOT EXISTS transcript_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL CHECK (speaker IN ('caller', 'ai', 'responder')),
  text TEXT NOT NULL,
  timestamp_iso TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  audio_offset_ms INTEGER,
  is_highlighted BOOLEAN DEFAULT false,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extracted fields table - AI-extracted data from calls
CREATE TABLE IF NOT EXISTS extracted_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_value TEXT,
  confidence DOUBLE PRECISION CHECK (confidence >= 0.0 AND confidence <= 1.0),
  source_block_id UUID REFERENCES transcript_blocks(id) ON DELETE SET NULL,
  verified_by UUID REFERENCES responders(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  locked_for_override BOOLEAN DEFAULT false,
  previous_value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(call_id, field_name)
);

-- Call actions table - Actions taken by responders
CREATE TABLE IF NOT EXISTS call_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES responders(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('dispatch', 'note', 'field_edit', 'transfer', 'mark_safe', 'escalate', 'redact', 'attachment')),
  action_data JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs table - Complete audit trail
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  responder_id UUID REFERENCES responders(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_priority ON calls(priority);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_assigned_responder ON calls(assigned_responder_id);
CREATE INDEX IF NOT EXISTS idx_transcript_blocks_call_id ON transcript_blocks(call_id);
CREATE INDEX IF NOT EXISTS idx_transcript_blocks_created_at ON transcript_blocks(created_at);
CREATE INDEX IF NOT EXISTS idx_extracted_fields_call_id ON extracted_fields(call_id);
CREATE INDEX IF NOT EXISTS idx_call_actions_call_id ON call_actions(call_id);
CREATE INDEX IF NOT EXISTS idx_call_actions_created_at ON call_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_call_id ON audit_logs(call_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to relevant tables
DROP TRIGGER IF EXISTS update_responders_updated_at ON responders;
CREATE TRIGGER update_responders_updated_at
  BEFORE UPDATE ON responders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_calls_updated_at ON calls;
CREATE TRIGGER update_calls_updated_at
  BEFORE UPDATE ON calls
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_extracted_fields_updated_at ON extracted_fields;
CREATE TRIGGER update_extracted_fields_updated_at
  BEFORE UPDATE ON extracted_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate AI confidence average
CREATE OR REPLACE FUNCTION calculate_ai_confidence_avg(p_call_id UUID)
RETURNS DOUBLE PRECISION AS $$
DECLARE
  avg_confidence DOUBLE PRECISION;
BEGIN
  SELECT AVG(confidence)
  INTO avg_confidence
  FROM extracted_fields
  WHERE call_id = p_call_id
  AND confidence IS NOT NULL;
  
  RETURN COALESCE(avg_confidence, 0.0);
END;
$$ LANGUAGE plpgsql;

-- Function to update call's AI confidence average
CREATE OR REPLACE FUNCTION update_call_ai_confidence()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE calls
  SET ai_confidence_avg = calculate_ai_confidence_avg(NEW.call_id)
  WHERE id = NEW.call_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update AI confidence when extracted fields change
DROP TRIGGER IF EXISTS update_call_confidence_on_field_change ON extracted_fields;
CREATE TRIGGER update_call_confidence_on_field_change
  AFTER INSERT OR UPDATE ON extracted_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_call_ai_confidence();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE responders ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Responders can view all responders" ON responders;
DROP POLICY IF EXISTS "Responders can update their own profile" ON responders;
DROP POLICY IF EXISTS "Responders can view all active calls" ON calls;
DROP POLICY IF EXISTS "Responders can view their assigned calls" ON calls;
DROP POLICY IF EXISTS "Responders can update calls they are assigned to" ON calls;
DROP POLICY IF EXISTS "Responders can view transcripts for active calls" ON transcript_blocks;
DROP POLICY IF EXISTS "Responders can view extracted fields for active calls" ON extracted_fields;
DROP POLICY IF EXISTS "Responders can update extracted fields for assigned calls" ON extracted_fields;
DROP POLICY IF EXISTS "Responders can view actions for active calls" ON call_actions;
DROP POLICY IF EXISTS "Responders can insert actions for assigned calls" ON call_actions;
DROP POLICY IF EXISTS "Supervisors and admins can view all audit logs" ON audit_logs;

-- Responders policies
CREATE POLICY "Responders can view all responders"
  ON responders FOR SELECT
  USING (true);

CREATE POLICY "Responders can update their own profile"
  ON responders FOR UPDATE
  USING (auth.uid() = id);

-- Calls policies
CREATE POLICY "Responders can view all active calls"
  ON calls FOR SELECT
  USING (status IN ('ai_handling', 'human_active'));

CREATE POLICY "Responders can view their assigned calls"
  ON calls FOR SELECT
  USING (assigned_responder_id = auth.uid());

CREATE POLICY "Responders can update calls they are assigned to"
  ON calls FOR UPDATE
  USING (assigned_responder_id = auth.uid());

-- Transcript blocks policies
CREATE POLICY "Responders can view transcripts for active calls"
  ON transcript_blocks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM calls
      WHERE calls.id = transcript_blocks.call_id
      AND calls.status IN ('ai_handling', 'human_active')
    )
  );

-- Extracted fields policies
CREATE POLICY "Responders can view extracted fields for active calls"
  ON extracted_fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM calls
      WHERE calls.id = extracted_fields.call_id
      AND calls.status IN ('ai_handling', 'human_active')
    )
  );

CREATE POLICY "Responders can update extracted fields for assigned calls"
  ON extracted_fields FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM calls
      WHERE calls.id = extracted_fields.call_id
      AND calls.assigned_responder_id = auth.uid()
    )
  );

-- Call actions policies
CREATE POLICY "Responders can view actions for active calls"
  ON call_actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM calls
      WHERE calls.id = call_actions.call_id
      AND calls.status IN ('ai_handling', 'human_active')
    )
  );

CREATE POLICY "Responders can insert actions for assigned calls"
  ON call_actions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calls
      WHERE calls.id = call_actions.call_id
      AND calls.assigned_responder_id = auth.uid()
    )
  );

-- Audit logs policies
CREATE POLICY "Supervisors and admins can view all audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM responders
      WHERE responders.id = auth.uid()
      AND responders.role IN ('supervisor', 'admin')
    )
  );

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert sample responders
INSERT INTO responders (id, email, name, role, phone, jurisdiction_id, active) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'dispatcher1@example.com', 'Sarah Johnson', 'dispatcher', '+1-555-0101', 'NORTH', true),
('550e8400-e29b-41d4-a716-446655440002', 'supervisor@example.com', 'Michael Chen', 'supervisor', '+1-555-0102', 'CENTRAL', true),
('550e8400-e29b-41d4-a716-446655440003', 'dispatcher2@example.com', 'Emma Davis', 'dispatcher', '+1-555-0103', 'SOUTH', true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample calls
INSERT INTO calls (id, call_id, status, priority, caller_phone, caller_name, source_type, incident_type, location_text, location_lat, location_lon, location_accuracy, impact_category, ai_confidence_avg, assigned_responder_id, number_of_victims, weapons_present, medical_emergency, started_at) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'CALL-2025-001', 'human_active', 'critical', '+1-555-1001', 'John Smith', 'phone', 'Medical Emergency', '123 Main Street, Downtown', 40.7128, -74.0060, 'exact', 'High', 0.87, '550e8400-e29b-41d4-a716-446655440001', 1, 'no', true, NOW() - INTERVAL '3 minutes'),
('660e8400-e29b-41d4-a716-446655440002', 'CALL-2025-002', 'ai_handling', 'high', '+1-555-1002', 'Jane Doe', 'phone', 'Fire', '456 Oak Avenue, Westside', 40.7282, -74.0776, 'approximate', 'High', 0.92, '550e8400-e29b-41d4-a716-446655440001', 3, 'unknown', false, NOW() - INTERVAL '7 minutes'),
('660e8400-e29b-41d4-a716-446655440003', 'CALL-2025-003', 'ai_handling', 'medium', '+1-555-1003', 'Robert Wilson', 'phone', 'Traffic Accident', '789 Elm Street, Eastside', 40.7489, -73.9680, 'gps_only', 'Medium', 0.75, '550e8400-e29b-41d4-a716-446655440003', 2, 'no', false, NOW() - INTERVAL '12 minutes')
ON CONFLICT (id) DO NOTHING;

-- Insert transcript blocks for CALL-2025-001
INSERT INTO transcript_blocks (call_id, speaker, text, timestamp_iso, audio_offset_ms, is_highlighted, tags) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'caller', 'Hello, I need help! My father collapsed!', NOW() - INTERVAL '3 minutes', 0, true, ARRAY['emergency', 'medical']),
('660e8400-e29b-41d4-a716-446655440001', 'ai', 'I understand this is an emergency. Can you tell me his current condition?', NOW() - INTERVAL '2 minutes 50 seconds', 10000, false, NULL),
('660e8400-e29b-41d4-a716-446655440001', 'caller', 'He is not breathing! We are at 123 Main Street!', NOW() - INTERVAL '2 minutes 40 seconds', 20000, true, ARRAY['critical', 'breathing']),
('660e8400-e29b-41d4-a716-446655440001', 'ai', 'Help is on the way. Is he conscious?', NOW() - INTERVAL '2 minutes 30 seconds', 30000, false, NULL),
('660e8400-e29b-41d4-a716-446655440001', 'caller', 'No, he is unconscious and not responding!', NOW() - INTERVAL '2 minutes 20 seconds', 40000, true, ARRAY['unconscious']),
('660e8400-e29b-41d4-a716-446655440001', 'ai', 'I am connecting you with a human responder now for immediate assistance.', NOW() - INTERVAL '2 minutes 10 seconds', 50000, false, NULL)
ON CONFLICT DO NOTHING;

-- Insert transcript blocks for CALL-2025-002
INSERT INTO transcript_blocks (call_id, speaker, text, timestamp_iso, audio_offset_ms, is_highlighted) VALUES
('660e8400-e29b-41d4-a716-446655440002', 'caller', 'There is a fire at my apartment building!', NOW() - INTERVAL '7 minutes', 0, true),
('660e8400-e29b-41d4-a716-446655440002', 'ai', 'Where is the fire located?', NOW() - INTERVAL '6 minutes 50 seconds', 10000, false),
('660e8400-e29b-41d4-a716-446655440002', 'caller', '456 Oak Avenue. Smoke is coming from the second floor!', NOW() - INTERVAL '6 minutes 40 seconds', 20000, true),
('660e8400-e29b-41d4-a716-446655440002', 'ai', 'Are there people inside the building?', NOW() - INTERVAL '6 minutes 30 seconds', 30000, false),
('660e8400-e29b-41d4-a716-446655440002', 'caller', 'Yes, I think there are about 3 people still inside!', NOW() - INTERVAL '6 minutes 20 seconds', 40000, true)
ON CONFLICT DO NOTHING;

-- Insert transcript blocks for CALL-2025-003
INSERT INTO transcript_blocks (call_id, speaker, text, timestamp_iso, audio_offset_ms) VALUES
('660e8400-e29b-41d4-a716-446655440003', 'caller', 'I witnessed a car accident on Elm Street.', NOW() - INTERVAL '12 minutes', 0),
('660e8400-e29b-41d4-a716-446655440003', 'ai', 'Can you describe what happened?', NOW() - INTERVAL '11 minutes 50 seconds', 10000),
('660e8400-e29b-41d4-a716-446655440003', 'caller', 'Two cars collided at the intersection. People look injured.', NOW() - INTERVAL '11 minutes 40 seconds', 20000),
('660e8400-e29b-41d4-a716-446655440003', 'ai', 'How many people are injured?', NOW() - INTERVAL '11 minutes 30 seconds', 30000),
('660e8400-e29b-41d4-a716-446655440003', 'caller', 'I see two people, one in each car. They are moving but appear hurt.', NOW() - INTERVAL '11 minutes 20 seconds', 40000)
ON CONFLICT DO NOTHING;

-- Insert extracted fields for CALL-2025-001
INSERT INTO extracted_fields (call_id, field_name, field_value, confidence, locked_for_override) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'incident_type', 'Medical Emergency', 0.95, false),
('660e8400-e29b-41d4-a716-446655440001', 'location', '123 Main Street, Downtown', 0.92, false),
('660e8400-e29b-41d4-a716-446655440001', 'impact_category', 'High', 0.87, false),
('660e8400-e29b-41d4-a716-446655440001', 'victims', '1', 0.90, false),
('660e8400-e29b-41d4-a716-446655440001', 'medical_info', 'Not breathing, unconscious', 0.88, false)
ON CONFLICT (call_id, field_name) DO NOTHING;

-- Insert extracted fields for CALL-2025-002
INSERT INTO extracted_fields (call_id, field_name, field_value, confidence, locked_for_override) VALUES
('660e8400-e29b-41d4-a716-446655440002', 'incident_type', 'Fire', 0.98, false),
('660e8400-e29b-41d4-a716-446655440002', 'location', '456 Oak Avenue, Westside', 0.85, false),
('660e8400-e29b-41d4-a716-446655440002', 'impact_category', 'High', 0.80, false),
('660e8400-e29b-41d4-a716-446655440002', 'victims', '3', 0.75, false),
('660e8400-e29b-41d4-a716-446655440002', 'threats', 'Smoke, potential structural damage', 0.82, false)
ON CONFLICT (call_id, field_name) DO NOTHING;

-- Insert extracted fields for CALL-2025-003
INSERT INTO extracted_fields (call_id, field_name, field_value, confidence, locked_for_override) VALUES
('660e8400-e29b-41d4-a716-446655440003', 'incident_type', 'Traffic Accident', 0.93, false),
('660e8400-e29b-41d4-a716-446655440003', 'location', '789 Elm Street, Eastside', 0.70, false),
('660e8400-e29b-41d4-a716-446655440003', 'impact_category', 'Medium', 0.75, false),
('660e8400-e29b-41d4-a716-446655440003', 'victims', '2', 0.85, false)
ON CONFLICT (call_id, field_name) DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Display summary of created data
SELECT 'Database setup complete!' as status;
SELECT COUNT(*) as responder_count FROM responders;
SELECT COUNT(*) as call_count FROM calls;
SELECT COUNT(*) as transcript_count FROM transcript_blocks;
SELECT COUNT(*) as extracted_field_count FROM extracted_fields;

