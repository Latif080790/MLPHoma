-- ============================================================
-- Migration 037: Fix Curvas Data Points UPSERT RLS
-- Root cause: The frontend uses `upsert` for `curvas_data_points` 
-- which requires both INSERT and UPDATE permissions.
-- ============================================================

-- Drop all previous overlapping policies for `curvas_data_points` to avoid conflicts
DROP POLICY IF EXISTS "allow_select_curvas_data_points" ON public.curvas_data_points;
DROP POLICY IF EXISTS "allow_insert_curvas_data_points" ON public.curvas_data_points;
DROP POLICY IF EXISTS "allow_update_curvas_data_points" ON public.curvas_data_points;
DROP POLICY IF EXISTS "allow_delete_curvas_data_points" ON public.curvas_data_points;

-- Enable RLS
ALTER TABLE public.curvas_data_points ENABLE ROW LEVEL SECURITY;

-- 1. SELECT Policy (Read access for project members)
CREATE POLICY "allow_select_curvas_data_points" ON public.curvas_data_points FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = curvas_data_points.project_id 
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
CREATE POLICY "allow_insert_curvas_data_points" ON public.curvas_data_points FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- 3. UPDATE Policy (Required for UPSERT)
CREATE POLICY "allow_update_curvas_data_points" ON public.curvas_data_points FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = curvas_data_points.project_id 
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
CREATE POLICY "allow_delete_curvas_data_points" ON public.curvas_data_points FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = curvas_data_points.project_id 
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
GRANT ALL ON public.curvas_data_points TO authenticated;
GRANT ALL ON public.curvas_data_points TO service_role;
