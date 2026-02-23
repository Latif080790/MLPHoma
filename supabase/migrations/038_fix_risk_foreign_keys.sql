-- 038_fix_risk_foreign_keys.sql
-- Purpose: Fix the relationship between risks and other tables (wbs, projects)
-- and ensure the missing wbs_id column is added.

DO $$
BEGIN
  -- 1. Ensure project_id column exists (just in case)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'risks' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE public.risks ADD COLUMN project_id TEXT;
  END IF;

  -- 2. Ensure wbs_id column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'risks' AND column_name = 'wbs_id'
  ) THEN
    ALTER TABLE public.risks ADD COLUMN wbs_id TEXT;
  END IF;

  -- 3. Clean up existing constraints before re-adding
  ALTER TABLE public.risks DROP CONSTRAINT IF EXISTS risks_project_id_fkey;
  ALTER TABLE public.risks DROP CONSTRAINT IF EXISTS risks_wbs_id_fkey;
  ALTER TABLE public.risks DROP CONSTRAINT IF EXISTS risks_wbs_item_id_fkey;

  -- 4. Apply Foreign Keys
  -- project_id -> projects(id)
  ALTER TABLE public.risks
  ADD CONSTRAINT risks_project_id_fkey 
  FOREIGN KEY (project_id) 
  REFERENCES public.projects(id) 
  ON DELETE CASCADE;

  -- wbs_id -> wbs_items(id)
  ALTER TABLE public.risks
  ADD CONSTRAINT risks_wbs_id_fkey 
  FOREIGN KEY (wbs_id) 
  REFERENCES public.wbs_items(id) 
  ON DELETE CASCADE;

END $$;

COMMENT ON TABLE public.risks IS 'Risk management records linked to projects and WBS items.';
