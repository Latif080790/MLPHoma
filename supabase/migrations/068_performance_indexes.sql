-- ============================================================
-- Migration: 068_performance_indexes.sql
-- Purpose: Add missing performance indexes for Phase 2 optimization
-- Idempotent: Uses CREATE INDEX IF NOT EXISTS
-- ============================================================

-- change_orders indexes (table created in 005 but never indexed)
CREATE INDEX IF NOT EXISTS idx_change_orders_project_id
  ON public.change_orders(project_id);

CREATE INDEX IF NOT EXISTS idx_change_orders_status
  ON public.change_orders(status);

CREATE INDEX IF NOT EXISTS idx_change_orders_project_status
  ON public.change_orders(project_id, status);

CREATE INDEX IF NOT EXISTS idx_change_orders_created_at
  ON public.change_orders(created_at DESC);

-- Composite index for timeline Gantt range queries
CREATE INDEX IF NOT EXISTS idx_timeline_tasks_project_dates
  ON public.timeline_tasks(project_id, start_date, end_date);

-- RAB baselines composite (project + version ordering)
CREATE INDEX IF NOT EXISTS idx_rab_baselines_project_created
  ON public.rab_baselines(project_id, created_at DESC);

-- AHSP items search support
CREATE INDEX IF NOT EXISTS idx_ahsp_items_code
  ON public.ahsp_items(code);

CREATE INDEX IF NOT EXISTS idx_ahsp_items_category_active
  ON public.ahsp_items(category, is_active);

-- Progress logs (project_id only - no task_id column)
CREATE INDEX IF NOT EXISTS idx_progress_logs_project_id
  ON public.progress_logs(project_id);

CREATE INDEX IF NOT EXISTS idx_progress_logs_date
  ON public.progress_logs(project_id, date DESC);
