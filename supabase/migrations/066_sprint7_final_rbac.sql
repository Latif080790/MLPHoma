-- ============================================================================
-- Migration 066: Sprint 7 Final RBAC & Optimistic Locking Enforcement
-- ============================================================================
-- 1. Enforce strict write-access for Supply Chain (purchase_orders, grn)
-- 2. Enforce strict write-access for Ops (timeline_tasks, wbs_items)
-- 3. Extend optimistic locking triggers if applicable
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Supply Chain RLS Updates
-- ----------------------------------------------------------------------------

-- A. purchase_orders
-- Allow specific roles: manager, admin, owner, procurement
DROP POLICY IF EXISTS "purchase_orders_write_role" ON public.purchase_orders;
CREATE POLICY "purchase_orders_write_role" ON public.purchase_orders
    FOR INSERT WITH CHECK (
        is_project_member_by_text(project_id)
        AND has_role(ARRAY['owner','admin','manager','procurement','ADMIN','PROJECT_MANAGER','PROCUREMENT'])
    );

DROP POLICY IF EXISTS "purchase_orders_update_role" ON public.purchase_orders;
CREATE POLICY "purchase_orders_update_role" ON public.purchase_orders
    FOR UPDATE USING (
        is_project_member_by_text(project_id)
        AND has_role(ARRAY['owner','admin','manager','procurement','ADMIN','PROJECT_MANAGER','PROCUREMENT'])
    );

DROP POLICY IF EXISTS "purchase_orders_delete_role" ON public.purchase_orders;
CREATE POLICY "purchase_orders_delete_role" ON public.purchase_orders
    FOR DELETE USING (
        is_project_member_by_text(project_id)
        AND has_role(ARRAY['owner','admin','manager','ADMIN']) -- Only managers/admins can delete
    );

-- B. finance_transactions (Journal ledger)
-- Found in 052_finance_tables.sql
DROP POLICY IF EXISTS "finance_txn_write_role" ON public.finance_transactions;
CREATE POLICY "finance_txn_write_role" ON public.finance_transactions
    FOR INSERT WITH CHECK (
        is_project_member_by_text(project_id)
        AND has_role(ARRAY['owner','admin','manager','finance','ADMIN','PROJECT_MANAGER','FINANCE'])
    );

DROP POLICY IF EXISTS "finance_txn_update_role" ON public.finance_transactions;
CREATE POLICY "finance_txn_update_role" ON public.finance_transactions
    FOR UPDATE USING (
        is_project_member_by_text(project_id)
        AND has_role(ARRAY['owner','admin','manager','finance','ADMIN','PROJECT_MANAGER','FINANCE'])
    );

DROP POLICY IF EXISTS "finance_txn_delete_role" ON public.finance_transactions;
CREATE POLICY "finance_txn_delete_role" ON public.finance_transactions
    FOR DELETE USING (
        is_project_member_by_text(project_id)
        AND has_role(ARRAY['owner','admin','manager','ADMIN'])
    );

-- C. grn (Goods Receipt Notes)
-- Make sure table exists first (it should in a standard setup)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'grn') THEN
        EXECUTE 'DROP POLICY IF EXISTS "grn_write_role" ON public.grn';
        EXECUTE 'CREATE POLICY "grn_write_role" ON public.grn
            FOR INSERT WITH CHECK (
                is_project_member_by_text(project_id)
                AND has_role(ARRAY[''owner'',''admin'',''manager'',''logistics'',''ADMIN'',''PROJECT_MANAGER'',''LOGISTICS''])
            )';
            
        EXECUTE 'DROP POLICY IF EXISTS "grn_update_role" ON public.grn';
        EXECUTE 'CREATE POLICY "grn_update_role" ON public.grn
            FOR UPDATE USING (
                is_project_member_by_text(project_id)
                AND has_role(ARRAY[''owner'',''admin'',''manager'',''logistics'',''ADMIN'',''PROJECT_MANAGER'',''LOGISTICS''])
            )';
    END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 2. Core Operations RLS Updates
-- ----------------------------------------------------------------------------

-- A. timeline_tasks
DROP POLICY IF EXISTS "timeline_tasks_write_role" ON public.timeline_tasks;
CREATE POLICY "timeline_tasks_write_role" ON public.timeline_tasks
    FOR INSERT WITH CHECK (
        is_project_member_by_text(project_id)
        AND has_role(ARRAY['owner','admin','manager','engineer','ADMIN','PROJECT_MANAGER','ENGINEER'])
    );

DROP POLICY IF EXISTS "timeline_tasks_update_role" ON public.timeline_tasks;
CREATE POLICY "timeline_tasks_update_role" ON public.timeline_tasks
    FOR UPDATE USING (
        is_project_member_by_text(project_id)
        AND has_role(ARRAY['owner','admin','manager','engineer','ADMIN','PROJECT_MANAGER','ENGINEER'])
    );

DROP POLICY IF EXISTS "timeline_tasks_delete_role" ON public.timeline_tasks;
CREATE POLICY "timeline_tasks_delete_role" ON public.timeline_tasks
    FOR DELETE USING (
        is_project_member_by_text(project_id)
        AND has_role(ARRAY['owner','admin','manager','engineer','ADMIN','PROJECT_MANAGER','ENGINEER'])
    );

-- B. wbs_items
DROP POLICY IF EXISTS "wbs_items_write_role" ON public.wbs_items;
CREATE POLICY "wbs_items_write_role" ON public.wbs_items
    FOR INSERT WITH CHECK (
        is_project_member_by_text(project_id)
        AND has_role(ARRAY['owner','admin','manager','engineer','ADMIN','PROJECT_MANAGER','ENGINEER'])
    );

DROP POLICY IF EXISTS "wbs_items_update_role" ON public.wbs_items;
CREATE POLICY "wbs_items_update_role" ON public.wbs_items
    FOR UPDATE USING (
        is_project_member_by_text(project_id)
        AND has_role(ARRAY['owner','admin','manager','engineer','ADMIN','PROJECT_MANAGER','ENGINEER'])
    );

DROP POLICY IF EXISTS "wbs_items_delete_role" ON public.wbs_items;
CREATE POLICY "wbs_items_delete_role" ON public.wbs_items
    FOR DELETE USING (
        is_project_member_by_text(project_id)
        AND has_role(ARRAY['owner','admin','manager','engineer','ADMIN','PROJECT_MANAGER','ENGINEER'])
    );
