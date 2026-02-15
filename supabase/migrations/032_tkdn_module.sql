-- ============================================================
-- 032_tkdn_module.sql
-- TKDN (Tingkat Komponen Dalam Negeri) table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tkdn_items (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN ('material', 'labor', 'equipment', 'service')),
  origin       TEXT NOT NULL CHECK (origin IN ('domestic', 'imported')),
  unit         TEXT NOT NULL DEFAULT '',
  quantity     NUMERIC NOT NULL DEFAULT 0,
  unit_price   NUMERIC NOT NULL DEFAULT 0,
  total_value  NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
  supplier          TEXT,
  country_of_origin TEXT,
  hs_code           TEXT,
  rab_item_id       TEXT,
  notes             TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by project
CREATE INDEX IF NOT EXISTS idx_tkdn_items_project ON public.tkdn_items(project_id);
CREATE INDEX IF NOT EXISTS idx_tkdn_items_category ON public.tkdn_items(project_id, category);

-- Enable RLS
ALTER TABLE public.tkdn_items ENABLE ROW LEVEL SECURITY;

-- Permissive policies (same pattern as other tables)
DROP POLICY IF EXISTS allow_select_tkdn_items ON public.tkdn_items;
CREATE POLICY allow_select_tkdn_items ON public.tkdn_items FOR SELECT USING (true);

DROP POLICY IF EXISTS allow_insert_tkdn_items ON public.tkdn_items;
CREATE POLICY allow_insert_tkdn_items ON public.tkdn_items FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS allow_update_tkdn_items ON public.tkdn_items;
CREATE POLICY allow_update_tkdn_items ON public.tkdn_items FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_delete_tkdn_items ON public.tkdn_items;
CREATE POLICY allow_delete_tkdn_items ON public.tkdn_items FOR DELETE USING (true);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_tkdn_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tkdn_items_updated_at ON public.tkdn_items;
CREATE TRIGGER trg_tkdn_items_updated_at
  BEFORE UPDATE ON public.tkdn_items
  FOR EACH ROW
  EXECUTE FUNCTION update_tkdn_items_updated_at();
