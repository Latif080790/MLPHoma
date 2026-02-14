-- ============================================================
-- Migration 031: Cross-Module Integration Enhancements
-- 1. Add name column to rap_items (eliminates Unnamed Item)
-- 2. Make rap_items.wbs_id FK nullable-safe
-- ============================================================

-- 1. Add name column to rap_items for local display
ALTER TABLE rap_items ADD COLUMN IF NOT EXISTS name TEXT;

-- 2. Backfill name from joined rab_items where possible
UPDATE rap_items r
SET name = rb.name
FROM rab_items rb
WHERE r.rab_item_id = rb.id
  AND r.name IS NULL
  AND rb.name IS NOT NULL;

-- 3. Drop the existing FK constraint on wbs_id if it exists
-- (it was created as NOT NULL referencing wbs_items which breaks when wbs_id is null or taskId)
DO $$
BEGIN
    -- Drop any existing FK on wbs_id
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'rap_items'
          AND kcu.column_name = 'wbs_id'
          AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
        EXECUTE (
            SELECT 'ALTER TABLE rap_items DROP CONSTRAINT ' || tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'rap_items'
              AND kcu.column_name = 'wbs_id'
              AND tc.constraint_type = 'FOREIGN KEY'
            LIMIT 1
        );
    END IF;
END $$;

-- 4. Re-create wbs_id FK that allows NULL and uses ON DELETE SET NULL
-- so invalid wbs_id values don't block inserts
ALTER TABLE rap_items
    ADD CONSTRAINT rap_items_wbs_id_fkey
    FOREIGN KEY (wbs_id) REFERENCES wbs_items(id)
    ON DELETE SET NULL;

-- 5. Clean up any invalid wbs_id values that point to non-existent wbs_items
UPDATE rap_items
SET wbs_id = NULL
WHERE wbs_id IS NOT NULL
  AND wbs_id NOT IN (SELECT id FROM wbs_items);
