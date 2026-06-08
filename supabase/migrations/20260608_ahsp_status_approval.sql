BEGIN;

ALTER TABLE ahsp_items
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'review', 'approved', 'archived'));

CREATE INDEX IF NOT EXISTS idx_ahsp_items_status ON ahsp_items (status);

COMMIT;
