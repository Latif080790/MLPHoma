-- ============================================================
-- Migration 036: Fix Curva-S Analysis UPSERT RLS
-- Root cause: The frontend uses `upsert` for `curvas_analyses` 
-- which requires both INSERT and UPDATE permissions.
-- ============================================================

-- Drop all previous overlapping policies for `curvas_analyses` to avoid conflicts
DROP POLICY IF EXISTS "allow_select_curvas_analyses" ON public.curvas_analyses;
DROP POLICY IF EXISTS "allow_insert_curvas_analyses" ON public.curvas_analyses;
DROP POLICY IF EXISTS "allow_update_curvas_analyses" ON public.curvas_analyses;
DROP POLICY IF EXISTS "allow_delete_curvas_analyses" ON public.curvas_analyses;

-- Enable RLS
ALTER TABLE public.curvas_analyses ENABLE ROW LEVEL SECURITY;

-- 1. SELECT Policy (Read access for project members)
CREATE POLICY "allow_select_curvas_analyses" ON public.curvas_analyses FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = curvas_analyses.project_id 
    AND (
      p.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.project_members pm 
        WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      )
    )
  )
);

-- 2. INSERT Policy (Write access if authenticated)
CREATE POLICY "allow_insert_curvas_analyses" ON public.curvas_analyses FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- 3. UPDATE Policy (Required for UPSERT)
CREATE POLICY "allow_update_curvas_analyses" ON public.curvas_analyses FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = curvas_analyses.project_id 
    AND (
      p.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.project_members pm 
        WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      )
    )
  )
);

-- 4. DELETE Policy
CREATE POLICY "allow_delete_curvas_analyses" ON public.curvas_analyses FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = curvas_analyses.project_id 
    AND (
      p.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.project_members pm 
        WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      )
    )
  )
);

-- Ensure grants are in place
GRANT ALL ON public.curvas_analyses TO authenticated;
GRANT ALL ON public.curvas_analyses TO service_role;
