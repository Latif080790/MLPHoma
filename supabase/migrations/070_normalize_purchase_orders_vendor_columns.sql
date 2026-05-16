-- ============================================================
-- Migration: 070_normalize_purchase_orders_vendor_columns.sql
-- Purpose: Normalize purchase_orders vendor columns across drifted schemas.
--          Keep vendor_name for backward compatibility while ensuring
--          vendor_id exists for newer relational flows.
-- Idempotent: Uses IF EXISTS / IF NOT EXISTS guards
-- ============================================================

DO $$
BEGIN
  -- Ensure vendor_id exists on purchase_orders
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'purchase_orders'
      AND column_name = 'vendor_id'
  ) THEN
    ALTER TABLE public.purchase_orders
      ADD COLUMN vendor_id uuid;
  END IF;

  -- Add FK only when vendors table exists and FK is not present yet
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'vendors'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purchase_orders_vendor_id_fkey'
      AND conrelid = 'public.purchase_orders'::regclass
  ) THEN
    ALTER TABLE public.purchase_orders
      ADD CONSTRAINT purchase_orders_vendor_id_fkey
      FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);
  END IF;
END $$;

-- Indexes for both legacy and normalized access patterns
CREATE INDEX IF NOT EXISTS idx_po_vendor_id
  ON public.purchase_orders(vendor_id)
  WHERE vendor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_po_vendor_name
  ON public.purchase_orders(vendor_name)
  WHERE vendor_name IS NOT NULL;
