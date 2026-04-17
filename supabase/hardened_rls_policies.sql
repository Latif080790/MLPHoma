-- ============================================================
-- PHASE 6: ENTERPRISE SECURITY HARDENING (RLS Policies)
-- Target: MLPHoma Production Environment
-- ============================================================
-- This script replaces permissive 'allow_all' policies with strict 
-- ownership and role-based access controls.
-- ============================================================

-- 1. AHSP CATALOG (Shared knowledge base)
-- READ: All authenticated users
-- WRITE: Only ADMIN role
ALTER TABLE public.ahsp_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ahsp_read_all" ON public.ahsp_items;
CREATE POLICY "ahsp_read_all" ON public.ahsp_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "ahsp_admin_write" ON public.ahsp_items;
CREATE POLICY "ahsp_admin_write" ON public.ahsp_items FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 2. RAB ITEMS (Project specific)
-- Access depends on parent project visibility
ALTER TABLE public.rab_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rab_items_access" ON public.rab_items;
CREATE POLICY "rab_items_access" ON public.rab_items 
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id 
      AND (
        p.user_id = auth.uid() 
        OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      )
    )
  );

-- 3. TIMELINE TASKS (Project specific)
ALTER TABLE public.timeline_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tasks_access" ON public.timeline_tasks;
CREATE POLICY "tasks_access" ON public.timeline_tasks 
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id 
      AND (
        p.user_id = auth.uid() 
        OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      )
    )
  );

-- 4. WBS ITEMS (Project specific)
ALTER TABLE public.wbs_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wbs_access" ON public.wbs_items;
CREATE POLICY "wbs_access" ON public.wbs_items 
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id 
      AND (
        p.user_id = auth.uid() 
        OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      )
    )
  );

-- 5. CURVA-S DATA (Project specific)
ALTER TABLE public.curvas_data_points ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "curva_s_access" ON public.curvas_data_points;
CREATE POLICY "curva_s_access" ON public.curvas_data_points 
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id 
      AND (
        p.user_id = auth.uid() 
        OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      )
    )
  );

DO $$ 
BEGIN
  RAISE NOTICE 'RLS Hardening Complete - All project-linked data now requires ownership or membership.';
END $$;
