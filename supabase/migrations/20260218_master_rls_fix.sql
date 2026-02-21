-- MLPHoma MASTER FIX (Universal Restore)
-- Purpose: Resolves 403 (Forbidden), 406 (Not Acceptable), and 400 (Bad Request).
-- This script resets RLS to a permissive state for development.

-- 1. CLEANUP OLD POLICIES (Prevent Conflicts)
-- ============================================================
DO $$ 
DECLARE 
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename IN ('projects', 'ahsp_items', 'ahsp_components', 'rab_versions', 'ahsp_creation_logs', 'rab_approvals', 'resources', 'rab_items')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_record.policyname, policy_record.tablename);
    END LOOP;
END $$;

-- 2. APPLY PERMISSIVE POLICIES (Bypass Ownership Issues)
-- ============================================================
-- Apply to all critical costing tables
DO $$ 
DECLARE 
    t TEXT;
    tables_to_fix TEXT[] := ARRAY['projects', 'ahsp_items', 'ahsp_components', 'rab_versions', 'ahsp_creation_logs', 'rab_approvals', 'resources', 'rab_items'];
BEGIN
    FOREACH t IN ARRAY tables_to_fix LOOP
        -- Enable RLS (Safe to run multiple times)
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        
        -- Create blanket access policy
        EXECUTE format('CREATE POLICY "allow_all_access" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;

-- 3. SCHEMA ALIGNMENT (Fix 400 Bad Request)
-- ============================================================
-- Correcting common column mismatches
ALTER TABLE public.rab_versions ADD COLUMN IF NOT EXISTS tags text[];
ALTER TABLE public.ahsp_creation_logs ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Ensure AHSP items has split prices for drift analysis
ALTER TABLE public.ahsp_items ADD COLUMN IF NOT EXISTS price_material numeric DEFAULT 0;
ALTER TABLE public.ahsp_items ADD COLUMN IF NOT EXISTS price_labor numeric DEFAULT 0;
ALTER TABLE public.ahsp_items ADD COLUMN IF NOT EXISTS price_equipment numeric DEFAULT 0;
ALTER TABLE public.ahsp_items ADD COLUMN IF NOT EXISTS price_subcon numeric DEFAULT 0;

-- 4. PERMISSIONS & CACHE RELOAD
-- ============================================================
-- Grant full permissions to all roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon, service_role;

-- Force PostgREST to reload the schema cache (Fixes 406 errors)
NOTIFY pgrst, 'reload schema';

DO $$ BEGIN RAISE NOTICE '✅ Master Fix Applied Successfully! Mohon refresh browser Anda.'; END $$;
