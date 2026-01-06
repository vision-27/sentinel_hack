-- ============================================================================
-- ENABLE PUBLIC ACCESS FOR AI AGENT
-- Run this to allow the client-side AI agent to create and update records
-- ============================================================================

-- 1. Allow creating new emergency calls
CREATE POLICY "Enable insert for all users" 
ON calls FOR INSERT 
WITH CHECK (true);

-- 2. Allow updating calls (needed for the agent to update location/details later)
CREATE POLICY "Enable update for all users" 
ON calls FOR UPDATE 
USING (true);

-- 3. Allow saving transcript blocks
CREATE POLICY "Enable insert for all users" 
ON transcript_blocks FOR INSERT 
WITH CHECK (true);

-- 4. Allow saving extracted fields (AI data extraction)
CREATE POLICY "Enable insert for all users" 
ON extracted_fields FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON extracted_fields FOR UPDATE 
USING (true);

