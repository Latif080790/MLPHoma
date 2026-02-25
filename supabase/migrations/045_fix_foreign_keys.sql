-- ============================================================
-- Migration: 045_fix_foreign_keys.sql
-- Purpose: Add missing foreign key constraints to rab_items table
-- Idempotent: Uses DO $$ blocks to check existence before adding
-- Safe: Cleans orphan rows before adding constraints
-- ============================================================

-- Add foreign key: rab_items.project_id -> projects.id
-- Cascade on delete: if project deleted, delete all related rab_items
DO $$
DECLARE
  orphan_count int;
BEGIN
  -- First ensure the table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rab_items') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'rab_items_project_id_fkey'
      AND table_name = 'rab_items'
    ) THEN

      -- Clean orphan rows first (project_id not in projects table)
      DELETE FROM public.rab_items
      WHERE project_id IS NOT NULL
        AND project_id NOT IN (SELECT id FROM public.projects);

      GET DIAGNOSTICS orphan_count = ROW_COUNT;
      RAISE NOTICE 'Cleaned % orphan rab_items (missing project_id)', orphan_count;

      EXECUTE 'ALTER TABLE public.rab_items ADD CONSTRAINT rab_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE';
    END IF;
  END IF;
END $$;

-- Add foreign key: rab_items.task_id -> timeline_tasks.id
-- Set null on delete: if task deleted, keep rab_item but clear task reference
DO $$
DECLARE
  orphan_count int;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rab_items') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'rab_items_task_id_fkey'
      AND table_name = 'rab_items'
    ) THEN

      -- Clean orphan rows first (task_id not in timeline_tasks table)
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'timeline_tasks') THEN
        UPDATE public.rab_items
        SET task_id = NULL
        WHERE task_id IS NOT NULL
          AND task_id NOT IN (SELECT id FROM public.timeline_tasks);

        GET DIAGNOSTICS orphan_count = ROW_COUNT;
        RAISE NOTICE 'Cleaned % orphan rab_items (missing task_id)', orphan_count;

        EXECUTE 'ALTER TABLE public.rab_items ADD CONSTRAINT rab_items_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.timeline_tasks(id) ON DELETE SET NULL';
      END IF;
    END IF;
  END IF;
END $$;
