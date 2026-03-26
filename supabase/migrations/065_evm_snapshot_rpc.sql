-- ============================================================
-- 065_evm_snapshot_rpc.sql
-- Automates daily project performance captures
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_snapshot_all_projects()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    p_record RECORD;
    v_total_budget NUMERIC;
    v_actual_cost NUMERIC;
    v_avg_progress NUMERIC;
    v_planned_progress NUMERIC;
    v_pv NUMERIC;
    v_ev NUMERIC;
    v_spi NUMERIC;
    v_cpi NUMERIC;
    v_snapshot_date DATE := CURRENT_DATE;
    v_results JSONB := '[]'::JSONB;
BEGIN
    FOR p_record IN SELECT id, name, start_date, end_date, budget FROM public.projects WHERE status IN ('ACTIVE', 'IN_PROGRESS') LOOP
        
        -- 1. Calculate Actual Progress (Average of timeline_tasks)
        SELECT COALESCE(AVG(progress), 0) INTO v_avg_progress
        FROM public.timeline_tasks
        WHERE project_id = p_record.id;

        -- 2. Calculate Actual Cost (Sum of rap_items actual_cost + tools_usage_logs)
        SELECT COALESCE(SUM(actual_cost), 0) INTO v_actual_cost
        FROM public.rap_items
        WHERE project_id = p_record.id;

        -- 3. Calculate Planned Progress (Linear interpolation)
        IF p_record.start_date IS NOT NULL AND p_record.end_date IS NOT NULL AND p_record.end_date > p_record.start_date THEN
            v_planned_progress := LEAST(100, GREATEST(0, (EXTRACT(EPOCH FROM (v_snapshot_date - p_record.start_date)) / EXTRACT(EPOCH FROM (p_record.end_date - p_record.start_date))) * 100));
        ELSE
            v_planned_progress := 0;
        END IF;

        -- 4. Calculate EVM Values
        v_total_budget := COALESCE(p_record.budget, 0);
        v_pv := (v_planned_progress / 100.0) * v_total_budget;
        v_ev := (v_avg_progress / 100.0) * v_total_budget;
        
        v_spi := CASE WHEN v_pv > 0 THEN v_ev / v_pv ELSE 1.0 END;
        v_cpi := CASE WHEN v_actual_cost > 0 THEN v_ev / v_actual_cost ELSE 1.0 END;

        -- 5. Upsert Dashboard Snapshot
        INSERT INTO public.project_daily_metrics (
            project_id, snapshot_date, pv, ev, ac, spi, cpi
        ) VALUES (
            p_record.id, v_snapshot_date, v_pv, v_ev, v_actual_cost, v_spi, v_cpi
        ) ON CONFLICT (project_id, snapshot_date) DO UPDATE SET
            pv = EXCLUDED.pv,
            ev = EXCLUDED.ev,
            ac = EXCLUDED.ac,
            spi = EXCLUDED.spi,
            cpi = EXCLUDED.cpi;

        v_results := v_results || jsonb_build_object(
            'project', p_record.name,
            'snapshot_date', v_snapshot_date,
            'spi', v_spi,
            'cpi', v_cpi
        );
    END LOOP;

    RETURN v_results;
END;
$$;
