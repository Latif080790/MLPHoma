-- ============================================================
-- MASTER MIGRATION FILE FOR SUPABASE SQL EDITOR
-- Generated: 2026-02-27
-- Purpose: Run this in your Supabase Dashboard > SQL Editor
-- to apply all pending schema changes safely.
-- ============================================================
-- This file is IDEMPOTENT — safe to run multiple times.
-- It handles missing tables/columns gracefully.
-- ============================================================

-- ============================================================
-- SECTION 1: RAB Overhead & BoQ Support (Phase 1 Enterprise)
-- ============================================================

-- 1a. Add is_overhead to rab_items
ALTER TABLE public.rab_items
ADD COLUMN IF NOT EXISTS is_overhead BOOLEAN DEFAULT false;

-- 1b. Add boq_id to rab_items for reverse mapping
ALTER TABLE public.rab_items
ADD COLUMN IF NOT EXISTS boq_id TEXT;

-- 1c. Index on is_overhead for faster filtering
CREATE INDEX IF NOT EXISTS idx_rab_items_is_overhead ON public.rab_items(is_overhead);

-- ============================================================
-- SECTION 2: Fix Foreign Key Constraints (Orphan Cleanup)
-- ============================================================

-- 2a. Clean orphan rab_items and add project FK
DO $$
DECLARE
  orphan_count int;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rab_items') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'rab_items_project_id_fkey'
      AND table_name = 'rab_items'
    ) THEN
      -- Clean orphan rows first
      DELETE FROM public.rab_items
      WHERE project_id IS NOT NULL
        AND project_id NOT IN (SELECT id FROM public.projects);
      GET DIAGNOSTICS orphan_count = ROW_COUNT;
      RAISE NOTICE 'Cleaned % orphan rab_items (missing project_id)', orphan_count;

      EXECUTE 'ALTER TABLE public.rab_items ADD CONSTRAINT rab_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE';
    END IF;
  END IF;
END $$;

-- 2b. Clean orphan task_ids and add task FK
DO $$
DECLARE
  orphan_count int;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rab_items') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'rab_items_task_id_fkey'
      AND table_name = 'rab_items'
    ) THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'timeline_tasks') THEN
        UPDATE public.rab_items SET task_id = NULL
        WHERE task_id IS NOT NULL
          AND task_id NOT IN (SELECT id FROM public.timeline_tasks);
        GET DIAGNOSTICS orphan_count = ROW_COUNT;
        RAISE NOTICE 'Cleaned % orphan rab_items (missing task_id)', orphan_count;

        EXECUTE 'ALTER TABLE public.rab_items ADD CONSTRAINT rab_items_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.timeline_tasks(id) ON DELETE SET NULL';
      END IF;
    END IF;
  END IF;
END $$;

-- ============================================================
-- SECTION 3: Risk Score Fix (Generated → Trigger-based)
-- ============================================================

DO $$
DECLARE
  is_generated text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'risks') THEN
    SELECT generation_expression INTO is_generated
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'risks' AND column_name = 'risk_score';

    IF is_generated IS NOT NULL AND is_generated != '' THEN
      ALTER TABLE public.risks DROP COLUMN risk_score;
      ALTER TABLE public.risks ADD COLUMN risk_score integer DEFAULT 1;
    END IF;

    UPDATE public.risks SET risk_score = COALESCE(probability, 1) * COALESCE(impact, 1)
    WHERE risk_score IS NULL OR risk_score = 1;
  END IF;
END $$;

-- Risk score auto-calculation trigger
CREATE OR REPLACE FUNCTION public.calc_risk_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.risk_score := COALESCE(NEW.probability, 1) * COALESCE(NEW.impact, 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'risks') THEN
    DROP TRIGGER IF EXISTS trg_calc_risk_score ON public.risks;
    CREATE TRIGGER trg_calc_risk_score
      BEFORE INSERT OR UPDATE OF probability, impact ON public.risks
      FOR EACH ROW EXECUTE FUNCTION public.calc_risk_score();
  END IF;
END $$;

-- ============================================================
-- SECTION 4: AHSP Component Columns
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ahsp_components') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ahsp_components' AND column_name = 'unit') THEN
      ALTER TABLE public.ahsp_components ADD COLUMN unit TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ahsp_components' AND column_name = 'unit_price') THEN
      ALTER TABLE public.ahsp_components ADD COLUMN unit_price NUMERIC DEFAULT 0;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'resources') THEN
      UPDATE public.ahsp_components ac
      SET unit = r.unit, unit_price = r.unit_price
      FROM public.resources r
      WHERE ac.resource_id = r.id AND (ac.unit IS NULL OR ac.unit_price = 0);
    END IF;
  END IF;
END $$;

-- ============================================================
-- SECTION 5: MR→PO Traceability 
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_orders') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'mr_id') THEN
      ALTER TABLE purchase_orders ADD COLUMN mr_id uuid REFERENCES material_requests(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ============================================================
-- DONE! All schema changes applied successfully.
-- ============================================================
SELECT 'Master migration completed successfully!' AS status;
