-- Migration: 044_rab_overhead_support.sql
-- Description: Add support for overhead costs and BoQ mapping in RAB items.

-- 1. Add is_overhead to rab_items
ALTER TABLE public.rab_items
ADD COLUMN IF NOT EXISTS is_overhead BOOLEAN DEFAULT false;

-- 2. Add boq_id to rab_items for reverse mapping
ALTER TABLE public.rab_items
ADD COLUMN IF NOT EXISTS boq_id TEXT;

-- 3. We might want to allow wbs_id to be NULL for overhead items
-- (Checking existing constraints, currently wbs_id is nullable in schema, 
-- but handled by UI. No DB constraint change strictly required for nullability assumption).

-- Optional: Create an index on is_overhead for faster filtering
CREATE INDEX IF NOT EXISTS idx_rab_items_is_overhead ON public.rab_items(is_overhead);
