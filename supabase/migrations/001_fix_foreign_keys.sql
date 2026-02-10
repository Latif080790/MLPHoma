-- ============================================================
-- Migration: 001_fix_foreign_keys.sql
-- Purpose: Add missing foreign key constraints to rab_items table
-- Idempotent: Uses DO $$ blocks to check existence before adding
-- ============================================================

-- Add foreign key: rab_items.project_id -> projects.id
-- Cascade on delete: if project deleted, delete all related rab_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'rab_items_project_id_fkey'
    AND table_name = 'rab_items'
  ) THEN
    ALTER TABLE public.rab_items
    ADD CONSTRAINT rab_items_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key: rab_items.task_id -> timeline_tasks.id
-- Set null on delete: if task deleted, keep rab_item but clear task reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'rab_items_task_id_fkey'
    AND table_name = 'rab_items'
  ) THEN
    ALTER TABLE public.rab_items
    ADD CONSTRAINT rab_items_task_id_fkey
    FOREIGN KEY (task_id) REFERENCES public.timeline_tasks(id) ON DELETE SET NULL;
  END IF;
END $$;
