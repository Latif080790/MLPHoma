-- ============================================================
-- Migration: 069_supply_risk_indexes.sql
-- Purpose: Add missing composite indexes for purchase_orders and risks
--          tables to support dashboard queries and supply-chain filters.
-- Idempotent: Uses CREATE INDEX IF NOT EXISTS
-- ============================================================

-- purchase_orders: project-scoped queries (supply chain, dashboard)
CREATE INDEX IF NOT EXISTS idx_po_project_id
  ON public.purchase_orders(project_id);

CREATE INDEX IF NOT EXISTS idx_po_project_status
  ON public.purchase_orders(project_id, status);

CREATE INDEX IF NOT EXISTS idx_po_project_created
  ON public.purchase_orders(project_id, created_at DESC);

-- purchase_orders: vendor lookups
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'purchase_orders'
      AND column_name = 'vendor_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_po_vendor_id ON public.purchase_orders(vendor_id) WHERE vendor_id IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'purchase_orders'
      AND column_name = 'vendor_name'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_po_vendor_name ON public.purchase_orders(vendor_name) WHERE vendor_name IS NOT NULL';
  END IF;
END $$;

-- risks: project-scoped queries (dashboard, risk register)
CREATE INDEX IF NOT EXISTS idx_risks_project_id
  ON public.risks(project_id);

CREATE INDEX IF NOT EXISTS idx_risks_project_status
  ON public.risks(project_id, status);

-- risks: time-ordered queries for risk timeline
CREATE INDEX IF NOT EXISTS idx_risks_project_created
  ON public.risks(project_id, created_at DESC);

-- rap_items: project-scoped EVM cost roll-up
CREATE INDEX IF NOT EXISTS idx_rap_items_project_id
  ON public.rap_items(project_id);

-- tools_usage_logs: project + date range (dashboard activity feed)
CREATE INDEX IF NOT EXISTS idx_tools_usage_project_created_at
  ON public.tools_usage_logs(project_id, created_at DESC)
  WHERE project_id IS NOT NULL;
