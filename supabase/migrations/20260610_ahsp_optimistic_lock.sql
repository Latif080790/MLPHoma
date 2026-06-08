-- Migration 20260610: Add DB triggers to auto-bump updated_at on every UPDATE.
-- This makes updated_at server-authoritative for optimistic conflict detection.

BEGIN;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ahsp_items: auto-bump updated_at on every UPDATE
DROP TRIGGER IF EXISTS ahsp_items_updated_at ON public.ahsp_items;
CREATE TRIGGER ahsp_items_updated_at
  BEFORE UPDATE ON public.ahsp_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ahsp_components: same
DROP TRIGGER IF EXISTS ahsp_components_updated_at ON public.ahsp_components;
CREATE TRIGGER ahsp_components_updated_at
  BEFORE UPDATE ON public.ahsp_components
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMIT;
