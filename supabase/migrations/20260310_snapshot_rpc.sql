-- ============================================================
-- Migration: SECURITY DEFINER RPC for Lock Baseline (Snapshot)
-- Problem: RLS on rab_items blocks UPDATE from browser client
-- Solution: SECURITY DEFINER RPC bypasses RLS
-- ============================================================

-- 1. RPC to take snapshot of all RAB items for a project
--    Returns JSON: { itemsSnapshotted, totalBaselineValue, timestamp }
CREATE OR REPLACE FUNCTION public.rpc_take_rab_snapshot(p_project_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timestamp timestamptz := now();
  v_count int := 0;
  v_total numeric := 0;
  v_item record;
BEGIN
  -- Loop through all RAB items with unit_price > 0
  FOR v_item IN
    SELECT id, unit_price, cost_material, cost_labor, cost_equipment, cost_subcon, volume
    FROM public.rab_items
    WHERE project_id = p_project_id
      AND COALESCE(unit_price, 0) > 0
  LOOP
    UPDATE public.rab_items
    SET
      snapshot_price = jsonb_build_object(
        'total', COALESCE(v_item.unit_price, 0),
        'material', COALESCE(v_item.cost_material, 0),
        'labor', COALESCE(v_item.cost_labor, 0),
        'equipment', COALESCE(v_item.cost_equipment, 0),
        'subcon', COALESCE(v_item.cost_subcon, 0),
        'at', v_timestamp
      ),
      base_price = COALESCE(v_item.unit_price, 0),
      updated_at = v_timestamp
    WHERE id = v_item.id;

    v_count := v_count + 1;
    v_total := v_total + (COALESCE(v_item.unit_price, 0) * COALESCE(v_item.volume, 0));
  END LOOP;

  RETURN jsonb_build_object(
    'itemsSnapshotted', v_count,
    'totalBaselineValue', v_total,
    'timestamp', v_timestamp
  );
END;
$$;

-- 2. RPC to check if a project has snapshot
CREATE OR REPLACE FUNCTION public.rpc_has_rab_snapshot(p_project_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rab_items
    WHERE project_id = p_project_id
      AND snapshot_price IS NOT NULL
  );
$$;

-- 3. RPC to get price drift analysis
CREATE OR REPLACE FUNCTION public.rpc_get_price_drift(p_project_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_drifts jsonb := '[]'::jsonb;
  v_item record;
  v_snapshot_total numeric;
  v_current numeric;
  v_drift numeric;
  v_drift_pct numeric;
  v_volume numeric;
BEGIN
  FOR v_item IN
    SELECT id, name, item_name, volume, unit_price, snapshot_price
    FROM public.rab_items
    WHERE project_id = p_project_id
      AND snapshot_price IS NOT NULL
  LOOP
    -- Extract snapshot total from JSONB
    v_snapshot_total := COALESCE((v_item.snapshot_price->>'total')::numeric, 0);
    v_current := COALESCE(v_item.unit_price, 0);
    v_volume := COALESCE(v_item.volume, 0);

    IF v_snapshot_total > 0 AND v_current > 0 AND abs(v_snapshot_total - v_current) > 0.01 THEN
      v_drift := v_current - v_snapshot_total;
      v_drift_pct := (v_drift / v_snapshot_total) * 100;

      v_drifts := v_drifts || jsonb_build_object(
        'rabItemId', v_item.id,
        'itemName', COALESCE(v_item.name, v_item.item_name, 'Unknown'),
        'snapshotPrice', v_snapshot_total,
        'currentPrice', v_current,
        'drift', v_drift,
        'driftPercentage', v_drift_pct,
        'volume', v_volume,
        'impactOnBudget', v_drift * v_volume
      );
    END IF;
  END LOOP;

  RETURN v_drifts;
END;
$$;

-- 4. RPC to get all RAB items for a project (bypasses RLS for re-fetch after snapshot)
CREATE OR REPLACE FUNCTION public.rpc_get_rab_items(p_project_id text)
RETURNS SETOF public.rab_items
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.rab_items WHERE project_id = p_project_id;
$$;

-- Grant execute to authenticated and anon roles
GRANT EXECUTE ON FUNCTION public.rpc_take_rab_snapshot(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rpc_has_rab_snapshot(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_price_drift(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_rab_items(text) TO authenticated, anon;
