-- ============================================================
-- Migration 035: Fix Curva-S Analysis Permissions
-- Root cause: Permission denied on table curvas_analyses
-- ============================================================

-- Ensure the table exists (from 034)
CREATE TABLE IF NOT EXISTS public.curvas_analyses (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    current_progress NUMERIC DEFAULT 0,
    spi NUMERIC DEFAULT 0,
    cpi NUMERIC DEFAULT 0,
    earned_value NUMERIC DEFAULT 0,
    planned_value NUMERIC DEFAULT 0,
    actual_cost NUMERIC DEFAULT 0,
    sv NUMERIC DEFAULT 0,
    cv NUMERIC DEFAULT 0,
    eac NUMERIC DEFAULT 0,
    etc NUMERIC DEFAULT 0,
    vac NUMERIC DEFAULT 0,
    status TEXT,
    forecast_completion_date DATE,
    forecast_total_cost NUMERIC DEFAULT 0,
    analysis_date DATE,
    insights JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grant permissions explicitly
GRANT ALL ON public.curvas_analyses TO authenticated;
GRANT ALL ON public.curvas_analyses TO service_role;

-- Re-enable RLS just in case
ALTER TABLE public.curvas_analyses ENABLE ROW LEVEL SECURITY;

-- Simplified policy: If you are authenticated, you can INSERT. 
-- SELECT/UPDATE/DELETE are already covered by project membership policies in 034.
DROP POLICY IF EXISTS "allow_insert_curvas_analyses" ON public.curvas_analyses;
CREATE POLICY "allow_insert_curvas_analyses" ON public.curvas_analyses FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Clean up any potential grant issues for other curvas tables
GRANT ALL ON public.curvas_data_points TO authenticated;
GRANT ALL ON public.curvas_data_points TO service_role;
GRANT ALL ON public.curvas_scenarios TO authenticated;
GRANT ALL ON public.curvas_scenarios TO service_role;
