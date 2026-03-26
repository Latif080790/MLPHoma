-- ============================================================
-- 062_strategy_simulations.sql
-- Persistent storage for "What-If" strategy scenarios.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.strategy_simulations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id   TEXT NOT NULL, -- Can be 'global' or a project UUID
  name         TEXT NOT NULL,
  description  TEXT,
  params       JSONB NOT NULL, -- { shiftDays: number, resourceChange: number }
  result       JSONB NOT NULL, -- Snapshot of result (spi, cashflow, etc.)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID -- References auth.users(id)
);

-- Enable RLS
ALTER TABLE public.strategy_simulations ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS allow_all_strategy_simulations ON public.strategy_simulations;
CREATE POLICY allow_all_strategy_simulations ON public.strategy_simulations FOR ALL USING (true) WITH CHECK (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_strategy_simulations_project_id ON public.strategy_simulations(project_id);
