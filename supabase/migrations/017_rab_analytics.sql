-- Migration: 017_rab_analytics.sql
-- Description: Adds TKDN percentage column to RAB items for local content tracking.

-- Add tkdn_percent column to rab_items if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'rab_items' 
        AND column_name = 'tkdn_percent'
    ) THEN
        ALTER TABLE public.rab_items ADD COLUMN tkdn_percent numeric DEFAULT 0;
    END IF;
END $$;
