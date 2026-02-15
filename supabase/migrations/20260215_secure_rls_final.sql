-- Migration: 20260215_secure_rls_final.sql
-- Purpose: Re-secure the database by removing "allow all" policies introduced in 015_v3_master_final.sql
--          and enforcing strict RLS based on ownership.

-- ============================================================
-- 1. SECURE PROJECTS TABLE
-- ============================================================
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Drop insecure policies
DROP POLICY IF EXISTS "Global Projects Access" ON public.projects;
DROP POLICY IF EXISTS "Allow public all projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;

-- Strict Policy: Users can only see/edit projects they own (linked via user_id)
-- We allow 'service_role' (backend) full access.
DROP POLICY IF EXISTS "Strict Project Access" ON public.projects;
CREATE POLICY "Strict Project Access" ON public.projects
  FOR ALL
  USING (
    auth.uid() = user_id 
    OR 
    EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = projects.id AND pm.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
  );

-- Allow inserting a new project (user claims ownership automatically via trigger or client logic)
DROP POLICY IF EXISTS "Allow Insert New Project" ON public.projects;
CREATE POLICY "Allow Insert New Project" ON public.projects
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- 2. SECURE SUB-TABLES (WBS, TASKS, RAB, RAP)
-- ============================================================

-- Helper macro logic: "User has access to project X"
-- We will repeat the EXISTS clause for clarity and compatibility

-- WBS ITEMS
ALTER TABLE public.wbs_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WBS global access" ON public.wbs_items;
DROP POLICY IF EXISTS "Allow public all wbs_items" ON public.wbs_items;

DROP POLICY IF EXISTS "WBS Linked Access" ON public.wbs_items;
CREATE POLICY "WBS Linked Access" ON public.wbs_items
  FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.projects p 
        WHERE p.id = wbs_items.project_id 
        AND (p.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    )
  );

-- TIMELINE TASKS
ALTER TABLE public.timeline_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all timeline_tasks" ON public.timeline_tasks;

DROP POLICY IF EXISTS "Task Linked Access" ON public.timeline_tasks;
CREATE POLICY "Task Linked Access" ON public.timeline_tasks
  FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.projects p 
        WHERE p.id = timeline_tasks.project_id 
        AND (p.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    )
  );

-- RAB ITEMS
ALTER TABLE public.rab_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all rab_items" ON public.rab_items;

DROP POLICY IF EXISTS "RAB Linked Access" ON public.rab_items;
CREATE POLICY "RAB Linked Access" ON public.rab_items
  FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.projects p 
        WHERE p.id = rab_items.project_id 
        AND (p.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    )
  );

-- RAP ITEMS (Checking both 'rap_items' and 'rap_data' as schema varied)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'rap_items') THEN
    ALTER TABLE public.rap_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "RAP global access" ON public.rap_items;
    DROP POLICY IF EXISTS "RAP Linked Access" ON public.rap_items;
    
    EXECUTE 'CREATE POLICY "RAP Linked Access" ON public.rap_items FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.projects p 
        WHERE p.id = rap_items.project_id 
        AND (p.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
      )
    )';
  END IF;
END $$;


-- ============================================================
-- 3. SECURE MASTER DATA (AHSP)
-- ============================================================
-- AHSP Items should be READABLE by all Authenticated users, but WRITABLE only by Admins (or all authenticated for now if no admin system)
-- For safety/usability now: All Authenticated can Read/Write. Anon is BLOCKED.

ALTER TABLE public.ahsp_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AHsp global access" ON public.ahsp_items;
DROP POLICY IF EXISTS "Allow public select ahsp_items" ON public.ahsp_items;
DROP POLICY IF EXISTS "Allow public insert ahsp_items" ON public.ahsp_items;
DROP POLICY IF EXISTS "Allow public update ahsp_items" ON public.ahsp_items;
DROP POLICY IF EXISTS "Allow public delete ahsp_items" ON public.ahsp_items;

DROP POLICY IF EXISTS "Authenticated AHSP Access" ON public.ahsp_items;
CREATE POLICY "Authenticated AHSP Access" ON public.ahsp_items
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Same for Resources
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public select resources" ON public.resources;
DROP POLICY IF EXISTS "Allow public insert resources" ON public.resources;
DROP POLICY IF EXISTS "Allow public update resources" ON public.resources;
DROP POLICY IF EXISTS "Allow public delete resources" ON public.resources;

DROP POLICY IF EXISTS "Authenticated Resource Access" ON public.resources;
CREATE POLICY "Authenticated Resource Access" ON public.resources
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');


-- ============================================================
-- 4. CLEANUP & VERIFICATION
-- ============================================================
-- Ensure Realtime is enabled only for appropriate tables if needed (usually fine to leave on)
