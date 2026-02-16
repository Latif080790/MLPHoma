-- Migration: 036_fix_project_members_and_storage.sql
-- Purpose: Fix "permission denied for table project_members" and create project-evidence storage bucket
-- Date: 2026-02-16

-- ============================================================
-- 1. FIX project_members TABLE PERMISSIONS
-- ============================================================
-- The table exists (from 030) but may be missing GRANTs to authenticated/anon roles.
-- "permission denied" is a table-level GRANT issue, not RLS.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT SELECT ON public.project_members TO anon;

-- Ensure RLS is still enabled
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Drop and re-create the policy to be sure it exists
DROP POLICY IF EXISTS "Users can view project memberships" ON public.project_members;
DROP POLICY IF EXISTS "Authenticated project_members access" ON public.project_members;

CREATE POLICY "Authenticated project_members access" ON public.project_members
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);


-- ============================================================
-- 2. CREATE project-evidence STORAGE BUCKET
-- ============================================================
-- The Progress module uploads photos to 'project-evidence' bucket.
-- If it doesn't exist, uploads fail with "Bucket not found".

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-evidence',
  'project-evidence',
  true,
  10485760, -- 10MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: allow authenticated users to upload/read
DROP POLICY IF EXISTS "Authenticated users can upload evidence" ON storage.objects;
CREATE POLICY "Authenticated users can upload evidence" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'project-evidence'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Anyone can view evidence" ON storage.objects;
CREATE POLICY "Anyone can view evidence" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'project-evidence');

DROP POLICY IF EXISTS "Authenticated users can update evidence" ON storage.objects;
CREATE POLICY "Authenticated users can update evidence" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'project-evidence'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Authenticated users can delete evidence" ON storage.objects;
CREATE POLICY "Authenticated users can delete evidence" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'project-evidence'
    AND auth.role() = 'authenticated'
  );


-- ============================================================
-- 3. ENSURE OTHER COMMONLY QUERIED TABLES HAVE GRANTS
-- ============================================================
-- These tables are queried by the frontend via Supabase client.
-- Missing GRANTs would cause the same "permission denied" error.

DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
  GRANT SELECT ON public.profiles TO anon;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_orders TO authenticated;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
