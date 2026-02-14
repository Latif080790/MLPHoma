-- 021_fix_rap_items_and_project_consistency.sql
-- Purpose: 
-- 1. Align rap_items schema with frontend requirements (split costs, period tracking)
-- Note: Type conversions (UUID -> TEXT) are deferred to 022_fix_id_types_cascade.sql for robustness.

DO $$
BEGIN
    -- 1. Add missing cost breakdown columns to rap_items
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rap_items' AND column_name = 'cost_material') THEN
        ALTER TABLE public.rap_items ADD COLUMN cost_material numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rap_items' AND column_name = 'cost_labor') THEN
        ALTER TABLE public.rap_items ADD COLUMN cost_labor numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rap_items' AND column_name = 'cost_equipment') THEN
        ALTER TABLE public.rap_items ADD COLUMN cost_equipment numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rap_items' AND column_name = 'cost_subcon') THEN
        ALTER TABLE public.rap_items ADD COLUMN cost_subcon numeric DEFAULT 0;
    END IF;

    -- 2. Add period tracking columns (for Periodic RAP)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rap_items' AND column_name = 'period_key') THEN
        ALTER TABLE public.rap_items ADD COLUMN period_key text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rap_items' AND column_name = 'period_type') THEN
        ALTER TABLE public.rap_items ADD COLUMN period_type text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rap_items' AND column_name = 'planned_volume') THEN
        ALTER TABLE public.rap_items ADD COLUMN planned_volume numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rap_items' AND column_name = 'planned_cost') THEN
        ALTER TABLE public.rap_items ADD COLUMN planned_cost numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rap_items' AND column_name = 'actual_volume') THEN
        ALTER TABLE public.rap_items ADD COLUMN actual_volume numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rap_items' AND column_name = 'status') THEN
        ALTER TABLE public.rap_items ADD COLUMN status text DEFAULT 'not_started';
    END IF;

END $$;
