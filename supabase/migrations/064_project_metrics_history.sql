-- ============================================================
-- 064_project_metrics_history.sql
-- EVM Snapshot and Forecasting Infrastructure
-- ============================================================

-- 1. Daily Performance Metrics (Snapshots)
CREATE TABLE IF NOT EXISTS public.project_daily_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    snapshot_date DATE DEFAULT CURRENT_DATE,
    pv NUMERIC NOT NULL DEFAULT 0, -- Planned Value
    ev NUMERIC NOT NULL DEFAULT 0, -- Earned Value
    ac NUMERIC NOT NULL DEFAULT 0, -- Actual Cost
    spi NUMERIC NOT NULL DEFAULT 1.0,
    cpi NUMERIC NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, snapshot_date)
);

-- 2. Forecasting Snapshots (Trend Analysis)
CREATE TABLE IF NOT EXISTS public.project_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    forecast_date DATE DEFAULT CURRENT_DATE,
    eac NUMERIC NOT NULL, -- Estimate At Completion
    etc NUMERIC NOT NULL, -- Estimate To Complete
    vac NUMERIC NOT NULL, -- Variance At Completion
    forecast_method TEXT DEFAULT 'STANDARD', -- 'STANDARD', 'CRITICAL_RATIO'
    confidence_score NUMERIC DEFAULT 1.0, -- 0.0 to 1.0
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexes for Trend Analysis
CREATE INDEX IF NOT EXISTS idx_metrics_project_date ON public.project_daily_metrics(project_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_forecasts_project_date ON public.project_forecasts(project_id, forecast_date);

-- 4. Enable RLS
ALTER TABLE public.project_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_forecasts ENABLE ROW LEVEL SECURITY;

-- 5. Policies
DROP POLICY IF EXISTS "Allow public select on project_daily_metrics" ON public.project_daily_metrics;
CREATE POLICY "Allow public select on project_daily_metrics" ON public.project_daily_metrics FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public select on project_forecasts" ON public.project_forecasts;
CREATE POLICY "Allow public select on project_forecasts" ON public.project_forecasts FOR SELECT USING (true);
