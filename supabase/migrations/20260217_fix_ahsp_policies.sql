-- Migration: 20260217_fix_ahsp_policies.sql
-- Purpose: Fix 403 Forbidden errors by adding RLS policies for ahsp_components and ahsp_price_history.
--          These tables were missed in the previous secure_rls migration.

-- ============================================================
-- 1. SECURE AHSP COMPONENTS
-- ============================================================

DO $$ BEGIN
  -- Check if table exists to avoid errors in case of schema drift
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'ahsp_components') THEN
    
    ALTER TABLE public.ahsp_components ENABLE ROW LEVEL SECURITY;

    -- Drop any existing insecure/conflicting policies
    DROP POLICY IF EXISTS "AHSP Components global access" ON public.ahsp_components;
    DROP POLICY IF EXISTS "Allow public all ahsp_components" ON public.ahsp_components;
    
    -- Create Authenticated Access Policy
    -- Matches the logic for ahsp_items: All authenticated users can read/write
    DROP POLICY IF EXISTS "Authenticated AHSP Component Access" ON public.ahsp_components;
    EXECUTE 'CREATE POLICY "Authenticated AHSP Component Access" ON public.ahsp_components
      FOR ALL
      USING (auth.role() = ''authenticated'')
      WITH CHECK (auth.role() = ''authenticated'')';
      
  END IF;
END $$;

-- ============================================================
-- 2. SECURE AHSP PRICE HISTORY
-- ============================================================

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'ahsp_price_history') THEN
  
    ALTER TABLE public.ahsp_price_history ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "AHSP History global access" ON public.ahsp_price_history;
    DROP POLICY IF EXISTS "Allow public all ahsp_price_history" ON public.ahsp_price_history;

    DROP POLICY IF EXISTS "Authenticated AHSP History Access" ON public.ahsp_price_history;
    EXECUTE 'CREATE POLICY "Authenticated AHSP History Access" ON public.ahsp_price_history
      FOR ALL
      USING (auth.role() = ''authenticated'')
      WITH CHECK (auth.role() = ''authenticated'')';
      
  END IF;
END $$;
