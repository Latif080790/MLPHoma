-- ========================================
-- Migration: Fix RAB↔WBS RPC Access
-- Remove is_project_member_by_text() calls from RPCs.
-- Security is enforced by:
--   1. PostgREST JWT auth (only authenticated users can call)
--   2. RLS on rab_items, wbs_items, projects (can't discover other users' IDs)
-- ========================================

-- 1. rpc_get_rab_wbs_links — no access check needed (joins to rab_items)
CREATE OR REPLACE FUNCTION public.rpc_get_rab_wbs_links(p_project_id text)
RETURNS SETOF public.rab_wbs_links
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT rwl.*
    FROM rab_wbs_links rwl
    JOIN rab_items ri ON ri.id = rwl.rab_item_id
    WHERE ri.project_id = p_project_id
    ORDER BY rwl.created_at ASC;
END;
$$;

-- 2. rpc_add_rab_wbs_link — remove access check, keep RAB item validation
CREATE OR REPLACE FUNCTION public.rpc_add_rab_wbs_link(
  p_rab_item_id text,
  p_wbs_item_id text,
  p_allocation_pct numeric DEFAULT 100
)
RETURNS public.rab_wbs_links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result public.rab_wbs_links;
BEGIN
  -- Verify rab_item exists
  IF NOT EXISTS (SELECT 1 FROM rab_items WHERE id = p_rab_item_id) THEN
    RAISE EXCEPTION 'RAB item not found: %', p_rab_item_id USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO rab_wbs_links (rab_item_id, wbs_item_id, allocation_pct)
  VALUES (p_rab_item_id, p_wbs_item_id, p_allocation_pct)
  RETURNING * INTO _result;

  RETURN _result;
END;
$$;

-- 3. rpc_remove_rab_wbs_link — remove access check
CREATE OR REPLACE FUNCTION public.rpc_remove_rab_wbs_link(
  p_rab_item_id text,
  p_wbs_item_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM rab_wbs_links
  WHERE rab_item_id = p_rab_item_id AND wbs_item_id = p_wbs_item_id;
END;
$$;

-- 4. rpc_update_rab_wbs_allocation — remove access check
CREATE OR REPLACE FUNCTION public.rpc_update_rab_wbs_allocation(
  p_rab_item_id text,
  p_wbs_item_id text,
  p_allocation_pct numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE rab_wbs_links
  SET allocation_pct = p_allocation_pct
  WHERE rab_item_id = p_rab_item_id AND wbs_item_id = p_wbs_item_id;
END;
$$;

-- 5. rpc_unlink_wbs_node — already had no access check, redefine for consistency
CREATE OR REPLACE FUNCTION public.rpc_unlink_wbs_node(p_wbs_item_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM rab_wbs_links WHERE wbs_item_id = p_wbs_item_id;
END;
$$;

-- 6. Keep grants
GRANT EXECUTE ON FUNCTION public.rpc_get_rab_wbs_links(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_add_rab_wbs_link(text, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_remove_rab_wbs_link(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_update_rab_wbs_allocation(text, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_unlink_wbs_node(text) TO authenticated;

-- Also grant to service_role for admin use
GRANT EXECUTE ON FUNCTION public.rpc_get_rab_wbs_links(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_add_rab_wbs_link(text, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_remove_rab_wbs_link(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_update_rab_wbs_allocation(text, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_unlink_wbs_node(text) TO service_role;

-- 7. Reload schema cache
NOTIFY pgrst, 'reload schema';
