-- ============================================================
-- 060_rab_tkdn_integration.sql
-- Integrates TKDN (Local Content) tracking directly into RAB items.
-- ============================================================

-- 1. Add TKDN fields to rab_items
ALTER TABLE public.rab_items
ADD COLUMN IF NOT EXISTS is_domestic BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS tkdn_percentage NUMERIC DEFAULT 100 CHECK (tkdn_percentage >= 0 AND tkdn_percentage <= 100);

-- 2. Create RPC for project-wide TKDN aggregation
-- Weighted average based on total_price
CREATE OR REPLACE FUNCTION public.rpc_compute_project_tkdn(p_project_id TEXT)
RETURNS jsonb AS $$
DECLARE
    v_total_project_cost NUMERIC;
    v_total_tkdn_weighted NUMERIC;
    v_final_tkdn_score NUMERIC;
BEGIN
    -- Calculate total project cost
    SELECT SUM(total_price) INTO v_total_project_cost
    FROM public.rab_items
    WHERE project_id = p_project_id;

    IF v_total_project_cost IS NULL OR v_total_project_cost = 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'tkdn_score', 0,
            'total_cost', 0,
            'message', 'No cost items found for project'
        );
    END IF;

    -- Calculate weighted TKDN: Sum(item_total * item_tkdn / 100)
    SELECT SUM(total_price * (tkdn_percentage / 100.0)) INTO v_total_tkdn_weighted
    FROM public.rab_items
    WHERE project_id = p_project_id;

    v_final_tkdn_score := (v_total_tkdn_weighted / v_total_project_cost) * 100.0;

    RETURN jsonb_build_object(
        'success', true,
        'tkdn_score', ROUND(v_final_tkdn_score, 2),
        'total_cost', v_total_project_cost,
        'weighted_tkdn_value', v_total_tkdn_weighted
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
