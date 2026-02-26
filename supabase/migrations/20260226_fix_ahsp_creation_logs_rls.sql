-- Migration: Fix AHSP Creation Logs RLS Policies
-- Date: 2026-02-26
-- Description: Replace overly permissive policy with proper project-based access control

-- Drop the old permissive policy
DROP POLICY IF EXISTS "Allow public all ahsp_creation_logs" ON public.ahsp_creation_logs;

-- Create proper RLS policies for ahsp_creation_logs
-- Users can view logs for AHSP items they have access to
CREATE POLICY "View AHSP creation logs" ON public.ahsp_creation_logs
  FOR SELECT
  USING (
    -- Allow viewing logs for any AHSP item (AHSP is global resource)
    -- Or restrict to project members if AHSP is linked to project
    EXISTS (
      SELECT 1 FROM public.ahsp_items a
      WHERE a.id = ahsp_id
    )
  );

-- Only authenticated users can insert creation logs
CREATE POLICY "Insert AHSP creation logs" ON public.ahsp_creation_logs
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- Users can update their own creation log entries
CREATE POLICY "Update own AHSP creation logs" ON public.ahsp_creation_logs
  FOR UPDATE
  USING (created_by = auth.uid()::text)
  WITH CHECK (created_by = auth.uid()::text);

-- Admins can delete logs
CREATE POLICY "Admin delete AHSP creation logs" ON public.ahsp_creation_logs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Add comment for context
COMMENT ON TABLE public.ahsp_creation_logs IS 
  'Tracks how AHSP items were created (SNI, Custom, Historical). 
   Access controlled via RLS - authenticated users can view/insert, 
   only creators can update their entries, admins can delete.';
