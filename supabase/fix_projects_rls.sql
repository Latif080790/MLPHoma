-- ============================================================
-- AGGRESSIVE FIX: Reset ALL RLS policies on projects table
-- Run this in Supabase Dashboard SQL Editor
-- ============================================================
-- The problem: FOR ALL policies block INSERT because the new row
-- doesn't exist yet, so is_project_member_by_text() returns false.
-- Fix: Drop all policies, create clean separate policies per operation.

-- Step 1: Drop ALL existing policies on projects
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'projects' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.projects', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- Step 2: Make sure RLS is enabled
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Step 3: Create clean policies

-- SELECT: Authenticated users can see their own projects + projects they're members of
CREATE POLICY "projects_select" ON public.projects
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = id AND pm.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
  );

-- INSERT: Any authenticated user can create a project
CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- UPDATE: Owner or member can update
CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = id AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- DELETE: Only owner can delete
CREATE POLICY "projects_delete" ON public.projects
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Verify
SELECT policyname, cmd, permissive, qual, with_check
FROM pg_policies
WHERE tablename = 'projects' AND schemaname = 'public';
