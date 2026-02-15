-- ============================================================
-- 033_add_updated_at_to_timeline_tasks.sql
-- Fix: timeline_tasks was created in 005 without updated_at.
-- Migration 009 tried CREATE TABLE IF NOT EXISTS which was a no-op.
-- This adds the missing column.
-- ============================================================

ALTER TABLE public.timeline_tasks
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Backfill existing rows
UPDATE public.timeline_tasks
  SET updated_at = COALESCE(created_at, now())
  WHERE updated_at IS NULL;

-- Auto-update trigger (re-create to be safe)
CREATE OR REPLACE FUNCTION update_timeline_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_timeline_tasks_updated_at ON public.timeline_tasks;
CREATE TRIGGER trg_timeline_tasks_updated_at
  BEFORE UPDATE ON public.timeline_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_timeline_tasks_updated_at();
