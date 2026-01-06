-- Fix for missing impact_category and other potential new columns in calls table

-- Add impact_category if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'impact_category') THEN
        ALTER TABLE calls ADD COLUMN impact_category TEXT DEFAULT 'None' CHECK (impact_category IN ('None', 'Low', 'Medium', 'High'));
    END IF;
END $$;

-- Add medical_emergency if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'medical_emergency') THEN
        ALTER TABLE calls ADD COLUMN medical_emergency BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Add weapons_present if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'weapons_present') THEN
        ALTER TABLE calls ADD COLUMN weapons_present TEXT DEFAULT 'unknown' CHECK (weapons_present IN ('yes', 'no', 'unknown'));
    END IF;
END $$;

-- Add number_of_victims if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'number_of_victims') THEN
        ALTER TABLE calls ADD COLUMN number_of_victims INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add ai_confidence_avg if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'ai_confidence_avg') THEN
        ALTER TABLE calls ADD COLUMN ai_confidence_avg DOUBLE PRECISION DEFAULT 0.0 CHECK (ai_confidence_avg >= 0.0 AND ai_confidence_avg <= 1.0);
    END IF;
END $$;

-- Refresh schema cache (this is usually automatic in Supabase but good to know)
NOTIFY pgrst, 'reload config';

