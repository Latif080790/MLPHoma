-- Migration 048: Add subcategory to ahsp_items and sort_order to ahsp_components
-- subcategory: optional sub-classification below category
-- sort_order: for persistent component ordering (drag-drop)

BEGIN;

-- Add subcategory to ahsp_items
ALTER TABLE ahsp_items
  ADD COLUMN IF NOT EXISTS subcategory TEXT DEFAULT '';

-- Add sort_order to ahsp_components
ALTER TABLE ahsp_components
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Backfill sort_order based on creation time order within each ahsp_item
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY ahsp_id ORDER BY created_at ASC) - 1 AS rn
  FROM ahsp_components
)
UPDATE ahsp_components
SET sort_order = ranked.rn
FROM ranked
WHERE ahsp_components.id = ranked.id;

-- Index for efficient component ordering queries
CREATE INDEX IF NOT EXISTS idx_ahsp_components_ahsp_sort
  ON ahsp_components (ahsp_id, sort_order ASC);

COMMIT;
