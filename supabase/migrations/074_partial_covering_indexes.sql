-- ============================================================
-- Migration: 074_partial_covering_indexes.sql
-- Purpose: Partial + covering indexes for high-frequency filtered queries
-- Strategy: Partial indexes shrink the B-tree to only rows that matter;
--           covering indexes avoid heap fetches for common SELECT projections.
-- Idempotent: Uses CREATE INDEX IF NOT EXISTS
-- ============================================================

-- ─── RAB Items ────────────────────────────────────────────────────────────────
-- Most RAB queries filter out deleted rows. Partial index reduces index size
-- by ~30-40% in typical projects where <20% of rows are deleted.
CREATE INDEX IF NOT EXISTS idx_rab_items_active_project
  ON public.rab_items(project_id, id)
  WHERE is_deleted = false;

-- Covering index for the cost-summary query (project_id + unit_price for SUM)
CREATE INDEX IF NOT EXISTS idx_rab_items_cost_cover
  ON public.rab_items(project_id, unit_price, volume)
  WHERE is_deleted = false;

-- ─── Purchase Orders ──────────────────────────────────────────────────────────
-- Active POs are the ones actually displayed in Supply Chain views.
-- CANCELLED + COMPLETED POs are historical and queried infrequently.
CREATE INDEX IF NOT EXISTS idx_po_active_project
  ON public.purchase_orders(project_id, created_at DESC)
  WHERE status NOT IN ('CANCELLED', 'COMPLETED');

-- PO items lookup by vendor name (used in anomaly detection PRICE_SPIKE)
CREATE INDEX IF NOT EXISTS idx_po_items_vendor_name
  ON public.purchase_order_items(item_name, unit_price);

-- ─── Progress Logs ────────────────────────────────────────────────────────────
-- Covering index for the EVM progress timeline join (project + task + date)
CREATE INDEX IF NOT EXISTS idx_progress_logs_cover
  ON public.progress_logs(project_id, task_id, date DESC)
  INCLUDE (progress_percentage);

-- ─── Timeline Tasks ───────────────────────────────────────────────────────────
-- Critical path queries filter by project and order by start_date.
-- Covering index avoids heap fetch for Gantt rendering.
CREATE INDEX IF NOT EXISTS idx_timeline_tasks_gantt_cover
  ON public.timeline_tasks(project_id, start_date, end_date)
  INCLUDE (name, progress, status);

-- ─── Maintenance ──────────────────────────────────────────────────────────────
-- Work orders dashboard only shows OPEN and IN_PROGRESS items.
CREATE INDEX IF NOT EXISTS idx_mwo_active_project
  ON public.maintenance_work_orders(project_id, priority, scheduled_date)
  WHERE status IN ('OPEN', 'IN_PROGRESS');

-- PPM schedule lookup (next upcoming maintenance)
CREATE INDEX IF NOT EXISTS idx_ppm_next_due
  ON public.maintenance_ppm_schedules(project_id, next_due_date)
  WHERE is_active = true;

-- ─── QHSE / HSE ───────────────────────────────────────────────────────────────
-- Safety dashboards only show open incidents.
CREATE INDEX IF NOT EXISTS idx_hse_incidents_open
  ON public.hse_incidents(project_id, date DESC)
  WHERE status != 'CLOSED';

-- Open inspections (overdue detection queries these frequently)
CREATE INDEX IF NOT EXISTS idx_hse_inspections_open
  ON public.hse_inspections(project_id, scheduled_date)
  WHERE status = 'OPEN';

-- ─── Subcontractors ───────────────────────────────────────────────────────────
-- SPK lookup by project + status (active SPKs shown in dashboard)
CREATE INDEX IF NOT EXISTS idx_subcontracts_active_project
  ON public.subcontracts(project_id, created_at DESC)
  WHERE status NOT IN ('TERMINATED', 'COMPLETED');

-- Progress claims awaiting approval
CREATE INDEX IF NOT EXISTS idx_subcon_progress_pending
  ON public.subcontract_progress(subcontract_id, period_number DESC)
  WHERE status IN ('SUBMITTED', 'APPROVED');
