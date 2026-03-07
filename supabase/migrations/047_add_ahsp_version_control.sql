-- ========================================
-- Migration 047: AHSP Version Control
-- Adds version tracking to ahsp_items and
-- enhances ahsp_price_history with full snapshot.
-- ========================================

-- 1. Add current_version counter to ahsp_items
ALTER TABLE public.ahsp_items
  ADD COLUMN IF NOT EXISTS current_version integer NOT NULL DEFAULT 1;

-- 2. Enhance ahsp_price_history with version + overhead/profit snapshot
ALTER TABLE public.ahsp_price_history
  ADD COLUMN IF NOT EXISTS version_number   integer,
  ADD COLUMN IF NOT EXISTS overhead_percentage numeric,
  ADD COLUMN IF NOT EXISTS profit_percentage   numeric,
  ADD COLUMN IF NOT EXISTS change_note         text;

-- 3. Backfill version_number=1 for existing history rows
UPDATE public.ahsp_price_history
  SET version_number = 1
  WHERE version_number IS NULL;

-- 4. Grant permissions (mirror existing table grants)
GRANT SELECT, INSERT, UPDATE ON public.ahsp_items TO authenticated;
GRANT SELECT, INSERT ON public.ahsp_price_history TO authenticated;
