-- 046_rap_items_schedule_dates.sql
-- Add schedule start/end date columns to rap_items for timeline-driven cost phasing.
-- These are populated by rapService.initFromRab() from linked timeline_tasks or RAPGeneratorSimple.

ALTER TABLE public.rap_items
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE;

COMMENT ON COLUMN public.rap_items.start_date IS 'Planned start date sourced from Timeline/Gantt task or RAP generator';
COMMENT ON COLUMN public.rap_items.end_date IS 'Planned end date sourced from Timeline/Gantt task or RAP generator';

-- Index for date-range queries used by S-curve and cost phasing reports
CREATE INDEX IF NOT EXISTS idx_rap_items_start_date ON public.rap_items (start_date);
CREATE INDEX IF NOT EXISTS idx_rap_items_end_date   ON public.rap_items (end_date);
