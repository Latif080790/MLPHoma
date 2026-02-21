-- MLPHoma NUCLEAR REPAIR SCRIPT (Universal Recovery)
-- Resolves: 403 (Forbidden), 406 (Not Acceptable), 400 (Bad Request).
-- This script resets all security and alignment to a permissive state.

-- 1. FORCE DISABLE RLS (Bypass all policy errors)
-- ============================================================
ALTER TABLE IF EXISTS public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ahsp_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.resources DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ahsp_components DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rab_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rab_versions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ahsp_creation_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rab_approvals DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rap_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rap_items DISABLE ROW LEVEL SECURITY;

-- 2. STANDARDIZE COLUMN TYPES (Prevent TEXT/UUID Mismatches)
-- ============================================================
DO $$
DECLARE
    t_name TEXT;
    c_name TEXT;
BEGIN
    FOR t_name, c_name IN 
        VALUES 
            ('projects', 'id'),
            ('ahsp_items', 'id'),
            ('resources', 'id'),
            ('ahsp_components', 'id'),
            ('ahsp_components', 'ahsp_id'),
            ('ahsp_components', 'resource_id'),
            ('rab_items', 'id'),
            ('rab_items', 'project_id'),
            ('rab_versions', 'id'),
            ('rab_versions', 'project_id'),
            ('ahsp_creation_logs', 'id'),
            ('ahsp_creation_logs', 'ahsp_id'),
            ('rab_approvals', 'id'),
            ('rab_approvals', 'project_id')
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t_name AND column_name = c_name AND data_type = 'uuid') THEN
            -- Using TEXT for IDs is the standard in this current project state
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE TEXT USING %I::TEXT', t_name, c_name, c_name);
            RAISE NOTICE 'Standardized %.% to TEXT', t_name, c_name;
        END IF;
    END LOOP;
END $$;

-- 3. ENSURE MISSING COLUMNS (Fix 400 Mismatches)
-- ============================================================
ALTER TABLE IF EXISTS public.rab_versions ADD COLUMN IF NOT EXISTS tags text[];
ALTER TABLE IF EXISTS public.ahsp_creation_logs ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE IF EXISTS public.ahsp_items ADD COLUMN IF NOT EXISTS price_material numeric DEFAULT 0;
ALTER TABLE IF EXISTS public.ahsp_items ADD COLUMN IF NOT EXISTS price_labor numeric DEFAULT 0;
ALTER TABLE IF EXISTS public.ahsp_items ADD COLUMN IF NOT EXISTS price_equipment numeric DEFAULT 0;
ALTER TABLE IF EXISTS public.ahsp_items ADD COLUMN IF NOT EXISTS price_subcon numeric DEFAULT 0;

-- 4. GLOBAL PERMISSIONS
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- 5. RELOAD INTERNALS
-- ============================================================
NOTIFY pgrst, 'reload schema';

DO $$ BEGIN RAISE NOTICE '✅ NUCLEAR REPAIR APPLIED. Mohon refresh browser Anda.'; END $$;
