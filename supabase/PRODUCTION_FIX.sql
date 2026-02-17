-- ==========================================
-- PRODUCTION FIX SCRIPT
-- Run this in Supabase SQL Editor to fix all issues
-- ==========================================

-- 1. Fix duplicate key constraints by ensuring proper unique constraints
-- Resources should use 'code' as unique identifier
DO $$
BEGIN
    -- Add unique constraint on resources.code if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'resources_code_key' 
        AND conrelid = 'public.resources'::regclass
    ) THEN
        ALTER TABLE public.resources 
        ADD CONSTRAINT resources_code_key UNIQUE (code);
    END IF;
    
    -- Add unique constraint on ahsp_items.code if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ahsp_items_code_key' 
        AND conrelid = 'public.ahsp_items'::regclass
    ) THEN
        ALTER TABLE public.ahsp_items 
        ADD CONSTRAINT ahsp_items_code_key UNIQUE (code);
    END IF;
END $$;

-- 2. Create ahsp_price_history table if missing
CREATE TABLE IF NOT EXISTS public.ahsp_price_history (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  ahsp_id text REFERENCES public.ahsp_items(id) ON DELETE CASCADE,
  zone_id uuid,
  
  -- Price snapshots
  old_price numeric,
  new_price numeric,
  
  -- Split costs
  price_material numeric DEFAULT 0,
  price_labor numeric DEFAULT 0,
  price_equipment numeric DEFAULT 0,
  price_subcon numeric DEFAULT 0,
  
  -- Change tracking
  change_type text,
  change_reason text,
  changed_by uuid,
  
  created_at timestamptz DEFAULT now()
);

-- 3. Add missing columns to ahsp_items if they don't exist
ALTER TABLE public.ahsp_items
  ADD COLUMN IF NOT EXISTS price_material numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_labor numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_equipment numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_subcon numeric DEFAULT 0;

-- 4. Enable RLS on ahsp_price_history
ALTER TABLE public.ahsp_price_history ENABLE ROW LEVEL SECURITY;

-- 5. Create policies for ahsp_price_history
DROP POLICY IF EXISTS "Allow public select ahsp_price_history" ON public.ahsp_price_history;
CREATE POLICY "Allow public select ahsp_price_history" 
  ON public.ahsp_price_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert ahsp_price_history" ON public.ahsp_price_history;
CREATE POLICY "Allow public insert ahsp_price_history" 
  ON public.ahsp_price_history FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update ahsp_price_history" ON public.ahsp_price_history;
CREATE POLICY "Allow public update ahsp_price_history" 
  ON public.ahsp_price_history FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete ahsp_price_history" ON public.ahsp_price_history;
CREATE POLICY "Allow public delete ahsp_price_history" 
  ON public.ahsp_price_history FOR DELETE USING (true);

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ahsp_price_history_ahsp_id 
  ON public.ahsp_price_history(ahsp_id);
  
CREATE INDEX IF NOT EXISTS idx_ahsp_price_history_zone_id 
  ON public.ahsp_price_history(zone_id);
  
CREATE INDEX IF NOT EXISTS idx_ahsp_price_history_created_at 
  ON public.ahsp_price_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_resources_code 
  ON public.resources(code);
  
CREATE INDEX IF NOT EXISTS idx_ahsp_items_code 
  ON public.ahsp_items(code);

-- 7. Clean up any duplicate data (optional - be careful!)
-- This will keep only the first record for each duplicate code
-- Uncomment if you want to remove duplicates

/*
-- Remove duplicate resources
DELETE FROM public.resources a USING (
    SELECT MIN(ctid) as ctid, code
    FROM public.resources 
    WHERE code IS NOT NULL
    GROUP BY code HAVING COUNT(*) > 1
) b
WHERE a.code = b.code AND a.ctid <> b.ctid;

-- Remove duplicate AHSP items
DELETE FROM public.ahsp_items a USING (
    SELECT MIN(ctid) as ctid, code
    FROM public.ahsp_items 
    WHERE code IS NOT NULL
    GROUP BY code HAVING COUNT(*) > 1
) b
WHERE a.code = b.code AND a.ctid <> b.ctid;
*/

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ All fixes applied successfully!';
    RAISE NOTICE '1. Unique constraints added for resources and AHSP items';
    RAISE NOTICE '2. ahsp_price_history table created';
    RAISE NOTICE '3. Split cost columns added to ahsp_items';
    RAISE NOTICE '4. RLS policies configured';
    RAISE NOTICE '5. Performance indexes created';
END $$;
