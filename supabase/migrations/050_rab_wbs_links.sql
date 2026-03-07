-- ========================================
-- Migration 050: RAB ↔ WBS Junction Table
-- Smart Allocation linking between RAB items
-- and WBS nodes with proportional budget rollup.
-- ========================================

-- 1. Create junction table
-- Note: rab_items.id is text (not uuid), wbs_items.id is also text.
-- wbs_item_id is a soft reference — app logic handles cascade on WBS delete.
CREATE TABLE IF NOT EXISTS public.rab_wbs_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rab_item_id     text NOT NULL REFERENCES public.rab_items(id) ON DELETE CASCADE,
  wbs_item_id     text NOT NULL,
  allocation_pct  numeric(6,2) NOT NULL DEFAULT 100.00 CHECK (allocation_pct >= 0 AND allocation_pct <= 100),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rab_item_id, wbs_item_id)
);

-- 2. Index for fast lookups by rab_item or wbs_item
CREATE INDEX IF NOT EXISTS idx_rab_wbs_links_rab_item  ON public.rab_wbs_links (rab_item_id);
CREATE INDEX IF NOT EXISTS idx_rab_wbs_links_wbs_item  ON public.rab_wbs_links (wbs_item_id);

-- 3. updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_rab_wbs_links_updated_at ON public.rab_wbs_links;
CREATE TRIGGER set_rab_wbs_links_updated_at
  BEFORE UPDATE ON public.rab_wbs_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Enable RLS
ALTER TABLE public.rab_wbs_links ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies — access scoped via parent rab_items → projects
-- Drop first to make this script idempotent (safe to re-run)
DROP POLICY IF EXISTS "select_rab_wbs_links" ON public.rab_wbs_links;
DROP POLICY IF EXISTS "insert_rab_wbs_links" ON public.rab_wbs_links;
DROP POLICY IF EXISTS "update_rab_wbs_links" ON public.rab_wbs_links;
DROP POLICY IF EXISTS "delete_rab_wbs_links" ON public.rab_wbs_links;

CREATE POLICY "select_rab_wbs_links" ON public.rab_wbs_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.rab_items ri
      JOIN public.projects p ON p.id = ri.project_id
      WHERE ri.id = rab_wbs_links.rab_item_id
        AND (p.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        ))
    )
  );

-- INSERT
CREATE POLICY "insert_rab_wbs_links" ON public.rab_wbs_links
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rab_items ri
      JOIN public.projects p ON p.id = ri.project_id
      WHERE ri.id = rab_wbs_links.rab_item_id
        AND (p.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        ))
    )
  );

-- UPDATE
CREATE POLICY "update_rab_wbs_links" ON public.rab_wbs_links
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.rab_items ri
      JOIN public.projects p ON p.id = ri.project_id
      WHERE ri.id = rab_wbs_links.rab_item_id
        AND (p.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        ))
    )
  );

-- DELETE
CREATE POLICY "delete_rab_wbs_links" ON public.rab_wbs_links
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.rab_items ri
      JOIN public.projects p ON p.id = ri.project_id
      WHERE ri.id = rab_wbs_links.rab_item_id
        AND (p.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        ))
    )
  );

-- 6. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rab_wbs_links TO authenticated;
