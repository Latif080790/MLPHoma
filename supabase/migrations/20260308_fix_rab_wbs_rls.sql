-- Fix RLS 403 on rab_wbs_links.
-- Use the EXISTING proven is_project_member_by_text(project_id) function
-- that already works for rab_items, wbs_items, etc.
-- We need a thin wrapper that maps rab_item_id -> project_id.

-- 1. Drop ALL existing policies (clean slate)
DROP POLICY IF EXISTS "select_rab_wbs_links" ON public.rab_wbs_links;
DROP POLICY IF EXISTS "insert_rab_wbs_links" ON public.rab_wbs_links;
DROP POLICY IF EXISTS "update_rab_wbs_links" ON public.rab_wbs_links;
DROP POLICY IF EXISTS "delete_rab_wbs_links" ON public.rab_wbs_links;
DROP POLICY IF EXISTS "Users can view their own rab_wbs_links" ON public.rab_wbs_links;
DROP POLICY IF EXISTS "Users can insert their own rab_wbs_links" ON public.rab_wbs_links;
DROP POLICY IF EXISTS "Users can update their own rab_wbs_links" ON public.rab_wbs_links;
DROP POLICY IF EXISTS "Users can delete their own rab_wbs_links" ON public.rab_wbs_links;

-- 2. Drop old custom function (no longer needed)
DROP FUNCTION IF EXISTS public.user_has_rab_item_access(text);

-- 3. Create a SECURITY DEFINER wrapper that resolves rab_item_id -> project_id
-- then delegates to the proven is_project_member_by_text function.
CREATE OR REPLACE FUNCTION public.rab_link_check_access(p_rab_item_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  _project_id text;
BEGIN
  -- Look up project_id from rab_items (bypasses RLS via SECURITY DEFINER)
  SELECT ri.project_id INTO _project_id
  FROM rab_items ri
  WHERE ri.id = p_rab_item_id;

  -- If rab_item not found, deny
  IF _project_id IS NULL THEN
    RETURN false;
  END IF;

  -- Delegate to the proven function that checks owner + member access
  RETURN is_project_member_by_text(_project_id);
END;
$$;

-- 4. Ensure RLS is enabled
ALTER TABLE public.rab_wbs_links ENABLE ROW LEVEL SECURITY;

-- 5. Create new policies using the wrapper
CREATE POLICY "select_rab_wbs_links" ON public.rab_wbs_links
  FOR SELECT USING (public.rab_link_check_access(rab_item_id));

CREATE POLICY "insert_rab_wbs_links" ON public.rab_wbs_links
  FOR INSERT WITH CHECK (public.rab_link_check_access(rab_item_id));

CREATE POLICY "update_rab_wbs_links" ON public.rab_wbs_links
  FOR UPDATE USING (public.rab_link_check_access(rab_item_id));

CREATE POLICY "delete_rab_wbs_links" ON public.rab_wbs_links
  FOR DELETE USING (public.rab_link_check_access(rab_item_id));

-- 6. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rab_wbs_links TO authenticated;
GRANT EXECUTE ON FUNCTION public.rab_link_check_access(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rab_link_check_access(text) TO anon;
