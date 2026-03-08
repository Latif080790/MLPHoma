-- Fix: rpc_get_price_drift referenced non-existent column "item_name"
-- Actual column is "name" only.

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
    SELECT id, name, volume, unit_price, snapshot_price
    FROM public.rab_items
    WHERE project_id = p_project_id
      AND snapshot_price IS NOT NULL
  LOOP
    v_snapshot_total := COALESCE((v_item.snapshot_price->>'total')::numeric, 0);
    v_current := COALESCE(v_item.unit_price, 0);
    v_volume := COALESCE(v_item.volume, 0);

    IF v_snapshot_total > 0 AND v_current > 0 AND abs(v_snapshot_total - v_current) > 0.01 THEN
      v_drift := v_current - v_snapshot_total;
      v_drift_pct := (v_drift / v_snapshot_total) * 100;

      v_drifts := v_drifts || jsonb_build_object(
        'rabItemId', v_item.id,
        'itemName', COALESCE(v_item.name, 'Unknown'),
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
