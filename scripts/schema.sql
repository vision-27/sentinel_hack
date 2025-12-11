-- First Responder Emergency Dashboard Database Schema
-- PostgreSQL / Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
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
-- INDEXES for performance
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
-- TRIGGERS for updated_at timestamps
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
-- REALTIME PUBLICATION (for Supabase Realtime)
-- ============================================================================

-- Enable realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE calls;
ALTER PUBLICATION supabase_realtime ADD TABLE transcript_blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE extracted_fields;
ALTER PUBLICATION supabase_realtime ADD TABLE call_actions;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate AI confidence average for a call
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
-- VIEWS for common queries
-- ============================================================================

-- View for active calls with responder details
CREATE OR REPLACE VIEW active_calls_with_responders AS
SELECT 
  c.*,
  r.name as responder_name,
  r.email as responder_email,
  r.role as responder_role
FROM calls c
LEFT JOIN responders r ON c.assigned_responder_id = r.id
WHERE c.status IN ('ai_handling', 'human_active')
ORDER BY c.priority DESC, c.created_at DESC;

-- View for call statistics
CREATE OR REPLACE VIEW call_statistics AS
SELECT
  status,
  priority,
  COUNT(*) as count,
  AVG(ai_confidence_avg) as avg_confidence
FROM calls
GROUP BY status, priority;

-- ============================================================================
-- COMMENTS for documentation
-- ============================================================================

COMMENT ON TABLE responders IS 'First responders, dispatchers, and system users';
COMMENT ON TABLE calls IS 'Emergency call records with incident details';
COMMENT ON TABLE transcript_blocks IS 'Real-time transcription of emergency calls';
COMMENT ON TABLE extracted_fields IS 'AI-extracted structured data from call transcripts';
COMMENT ON TABLE call_actions IS 'Actions taken by responders during calls';
COMMENT ON TABLE audit_logs IS 'Complete audit trail of all system actions';

