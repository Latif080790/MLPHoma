-- ============================================================================
-- Migration 054: Server-Side RBAC Enforcement + Optimistic Locking
-- ============================================================================
-- Part A: Proper server-side role check function using profiles table
-- Part B: Optimistic locking RPC guard for concurrent edit protection
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- PART A: SERVER-SIDE RBAC ENFORCEMENT
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Create helper function: get_my_role()
-- Returns the role of the currently authenticated user from profiles table.
-- Falls back to 'viewer' if no role found (secure default).
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid()),
    'viewer'
  );
$$;

-- 2. Create helper function: has_role(required_roles text[])
-- Returns true if current user's role is in the provided array.
CREATE OR REPLACE FUNCTION has_role(required_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_my_role() = ANY(required_roles);
$$;

-- 3. Apply WRITE-protection RLS policies to finance tables
-- Finance invoices: only finance/admin/manager/owner can INSERT/UPDATE
DROP POLICY IF EXISTS "finance_invoices_write_role" ON finance_invoices;
CREATE POLICY "finance_invoices_write_role" ON finance_invoices
    FOR INSERT WITH CHECK (
        is_project_member_by_text(project_id)
        AND has_role(ARRAY['owner','admin','manager','finance','ADMIN','PROJECT_MANAGER','FINANCE'])
    );

DROP POLICY IF EXISTS "finance_invoices_update_role" ON finance_invoices;
CREATE POLICY "finance_invoices_update_role" ON finance_invoices
    FOR UPDATE USING (
        is_project_member_by_text(project_id)
        AND has_role(ARRAY['owner','admin','manager','finance','ADMIN','PROJECT_MANAGER','FINANCE'])
    );

-- Finance claims: only manager/admin/owner can INSERT/UPDATE
DROP POLICY IF EXISTS "finance_claims_write_role" ON finance_claims;
CREATE POLICY "finance_claims_write_role" ON finance_claims
    FOR INSERT WITH CHECK (
        is_project_member_by_text(project_id)
        AND has_role(ARRAY['owner','admin','manager','ADMIN','PROJECT_MANAGER'])
    );

DROP POLICY IF EXISTS "finance_claims_update_role" ON finance_claims;
CREATE POLICY "finance_claims_update_role" ON finance_claims
    FOR UPDATE USING (
        is_project_member_by_text(project_id)
        AND has_role(ARRAY['owner','admin','manager','ADMIN','PROJECT_MANAGER'])
    );

-- 4. Protect RAB items write access (engineer+ can edit)
-- Drop overly-permissive old policies if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'rab_items') THEN
        EXECUTE 'DROP POLICY IF EXISTS "rab_write_role" ON rab_items';
        EXECUTE 'CREATE POLICY "rab_write_role" ON rab_items
            FOR UPDATE USING (
                has_role(ARRAY[''owner'',''admin'',''manager'',''engineer'',''ADMIN'',''PROJECT_MANAGER'',''ENGINEER''])
            )';
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- PART B: OPTIMISTIC LOCKING
-- ═══════════════════════════════════════════════════════════════════════════

-- RPC function: Attempts an UPDATE on any table and verifies that the
-- row has not been modified since the client last read it (via updated_at).
-- Returns the updated row if successful, or raises an exception on conflict.

CREATE OR REPLACE FUNCTION rpc_optimistic_update(
    p_table_name text,
    p_id text,
    p_expected_updated_at timestamptz,
    p_updates jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
    v_current_updated_at timestamptz;
    v_sql text;
    v_set_clause text := '';
    v_key text;
    v_value jsonb;
BEGIN
    -- Whitelist allowed tables to prevent SQL injection
    IF p_table_name NOT IN (
        'projects', 'rab_items', 'wbs_items', 'rap_items',
        'timeline_tasks', 'finance_invoices', 'finance_claims',
        'finance_transactions', 'purchase_orders'
    ) THEN
        RAISE EXCEPTION 'Table "%" is not allowed for optimistic update', p_table_name;
    END IF;

    -- Check current updated_at
    EXECUTE format(
        'SELECT updated_at FROM %I WHERE id = $1',
        p_table_name
    ) INTO v_current_updated_at USING p_id;

    IF v_current_updated_at IS NULL THEN
        RAISE EXCEPTION 'Row with id "%" not found in table "%"', p_id, p_table_name;
    END IF;

    -- Compare timestamps (with 1-second tolerance for network latency)
    IF v_current_updated_at > p_expected_updated_at + interval '1 second' THEN
        RAISE EXCEPTION 'OPTIMISTIC_LOCK_CONFLICT: Row was modified by another user at %. Your version was from %. Please reload and try again.',
            v_current_updated_at, p_expected_updated_at;
    END IF;

    -- Build SET clause dynamically from p_updates jsonb
    FOR v_key, v_value IN SELECT * FROM jsonb_each(p_updates)
    LOOP
        -- Skip protected fields
        IF v_key IN ('id', 'created_at', 'project_id') THEN
            CONTINUE;
        END IF;
        IF v_set_clause != '' THEN
            v_set_clause := v_set_clause || ', ';
        END IF;
        v_set_clause := v_set_clause || format('%I = %L', v_key, v_value #>> '{}');
    END LOOP;

    -- Always update updated_at
    v_set_clause := v_set_clause || ', updated_at = now()';

    -- Execute the update
    v_sql := format(
        'UPDATE %I SET %s WHERE id = $1 AND updated_at <= $2 RETURNING row_to_json(%I.*)::jsonb',
        p_table_name, v_set_clause, p_table_name
    );

    EXECUTE v_sql INTO v_result USING p_id, p_expected_updated_at + interval '1 second';

    IF v_result IS NULL THEN
        RAISE EXCEPTION 'OPTIMISTIC_LOCK_CONFLICT: Concurrent modification detected. Please reload and try again.';
    END IF;

    RETURN v_result;
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION has_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_optimistic_update(text, text, timestamptz, jsonb) TO authenticated;
