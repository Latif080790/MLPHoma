-- ============================================================
-- Migration: RPC to unlock baseline (clear snapshot_price & base_price)
-- ============================================================

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

GRANT EXECUTE ON FUNCTION public.rpc_unlock_rab_baseline(text) TO authenticated, anon;
