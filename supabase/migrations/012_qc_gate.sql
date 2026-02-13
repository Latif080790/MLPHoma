-- 012_qc_gate.sql
-- Add Quality Control (QC) Gate to Schedule
-- This ensures that tasks can only be 100% complete if QC is PASSED (or NOT_REQUIRED)

ALTER TABLE wbs_items 
ADD COLUMN IF NOT EXISTS qc_status text DEFAULT 'NOT_REQUIRED';

-- Add check constraint for valid QC statuses
ALTER TABLE wbs_items
ADD CONSTRAINT wbs_items_qc_status_check 
CHECK (qc_status IN ('PENDING', 'PASSED', 'FAILED', 'NOT_REQUIRED'));

-- Add index for querying QC status
CREATE INDEX IF NOT EXISTS idx_wbs_items_qc_status ON wbs_items(qc_status);

-- Optional: Comment
COMMENT ON COLUMN wbs_items.qc_status IS 'Quality Control status. Must be PASSED or NOT_REQUIRED to reach 100% progress.';
