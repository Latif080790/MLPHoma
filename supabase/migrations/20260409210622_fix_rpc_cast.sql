-- ============================================================
-- FINAL FIX: Restore correct RPC functions + Fix Audit Trigger
-- ============================================================
-- Root causes fixed:
--   1. snapshot_price is JSONB (not numeric) — must use jsonb_build_object()
--   2. project_id is TEXT (not UUID) — no ::uuid cast needed
--   3. Audit trigger was inserting text string into UUID column
-- ============================================================

-- 1. Restore rpc_take_rab_snapshot with correct JSONB snapshot_price
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

-- 2. Restore rpc_unlock_rab_baseline (text comparison, no UUID cast)
CREATE OR REPLACE FUNCTION public.rpc_unlock_rab_baseline(p_project_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.rab_items
  SET snapshot_price = NULL,
      base_price = NULL,
      updated_at = now()
  WHERE project_id = p_project_id
    AND snapshot_price IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'itemsUnlocked', v_count,
    'timestamp', now()
  );
END;
$$;

-- 3. Fix audit trigger: use gen_random_uuid() instead of text string for UUID column
CREATE OR REPLACE FUNCTION log_immutable_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_type TEXT;
  v_entity_name TEXT;
  v_action TEXT;
  v_details JSONB;
  v_uid UUID;
  v_username TEXT;
  v_new_json JSONB;
  v_old_json JSONB;
BEGIN
  v_entity_type := TG_ARGV[0];
  v_uid := auth.uid();
  v_username := get_auth_user_name();
  
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    v_new_json := to_jsonb(NEW);
    v_entity_name := COALESCE(v_new_json->>'name', v_new_json->>'title', v_new_json->>'id');
  END IF;
  
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    v_old_json := to_jsonb(OLD);
    IF TG_OP = 'DELETE' THEN
      v_entity_name := COALESCE(v_old_json->>'name', v_old_json->>'title', v_old_json->>'id');
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := v_entity_type || '_CREATED';
    v_details := jsonb_build_object('new_data', v_new_json);
    INSERT INTO audit_logs (id, user_id, user_name, action, entity, entity_type, entity_id, details, created_at)
    VALUES (gen_random_uuid(), v_uid, v_username, v_action, v_entity_name, v_entity_type, v_new_json->>'id', v_details, now());
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF v_old_json IS DISTINCT FROM v_new_json THEN
      v_action := v_entity_type || '_UPDATED';
      IF v_old_json->>'status' IS DISTINCT FROM v_new_json->>'status' THEN
         v_action := v_entity_type || '_STATUS_CHANGED';
      END IF;
      v_details := jsonb_build_object('old_data', v_old_json, 'new_data', v_new_json);
      INSERT INTO audit_logs (id, user_id, user_name, action, entity, entity_type, entity_id, details, created_at)
      VALUES (gen_random_uuid(), v_uid, v_username, v_action, v_entity_name, v_entity_type, v_new_json->>'id', v_details, now());
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_action := v_entity_type || '_DELETED';
    v_details := jsonb_build_object('old_data', v_old_json);
    INSERT INTO audit_logs (id, user_id, user_name, action, entity, entity_type, entity_id, details, created_at)
    VALUES (gen_random_uuid(), v_uid, v_username, v_action, v_entity_name, v_entity_type, v_old_json->>'id', v_details, now());
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION public.rpc_take_rab_snapshot(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rpc_unlock_rab_baseline(text) TO authenticated, anon;
