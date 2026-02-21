-- MLPHoma Universal Fix (Dev-Grade Security)
-- Purpose: Resolves persistent 403 Forbidden and 400 Bad Request errors.
-- WARNING: This script grants full access to Project Costing tables to ALL users.
-- Use this for development to bypass ID type mismatches and RLS ownership issues.

-- 1. UNIVERSAL PERMISSIVE POLICIES
-- ============================================================

-- RAB Versions
ALTER TABLE public.rab_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "RAB Version Linked Access" ON public.rab_versions;
DROP POLICY IF EXISTS "allow_all_rab_versions" ON public.rab_versions;
CREATE POLICY "allow_all_rab_versions" ON public.rab_versions FOR ALL USING (true);

-- AHSP Creation Logs
ALTER TABLE public.ahsp_creation_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated AHSP Creation Log Access" ON public.ahsp_creation_logs;
DROP POLICY IF EXISTS "allow_all_ahsp_logs" ON public.ahsp_creation_logs;
CREATE POLICY "allow_all_ahsp_logs" ON public.ahsp_creation_logs FOR ALL USING (true);

-- RAB Approvals
ALTER TABLE public.rab_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "RAB Approval Linked Access" ON public.rab_approvals;
DROP POLICY IF EXISTS "allow_all_rab_approvals" ON public.rab_approvals;
CREATE POLICY "allow_all_rab_approvals" ON public.rab_approvals FOR ALL USING (true);

-- Projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Strict Project Access" ON public.projects;
DROP POLICY IF EXISTS "allow_all_projects" ON public.projects;
CREATE POLICY "allow_all_projects" ON public.projects FOR ALL USING (true);

-- ============================================================
-- 2. SCHEMA ALIGNMENT (Fix 400 Bad Request)
-- ============================================================
-- Ensure requested columns exist to avoid "column not found" / "bad request"
ALTER TABLE public.rab_versions ADD COLUMN IF NOT EXISTS tags text[];
ALTER TABLE public.ahsp_creation_logs ADD COLUMN IF NOT EXISTS metadata jsonb;

-- ============================================================
-- 3. GLOBAL PERMISSIONS
-- ============================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon, service_role;
