-- ============================================================
-- 008_immutable_audit.sql
-- Phase 10: Traceability & Governance
-- 1. Add mr_id to purchase_orders for MR→PO traceability
-- 2. Enforce append-only on activity_logs (immutable audit)
-- ============================================================

-- ----------------------------------------------------------
-- 1. Add mr_id to purchase_orders (nullable FK)
-- ----------------------------------------------------------
ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS mr_id text REFERENCES material_requests(id) ON DELETE SET NULL;

COMMENT ON COLUMN purchase_orders.mr_id IS 'Optional link to originating Material Request for full traceability';

-- ----------------------------------------------------------
-- 2. Immutable audit log — Deny UPDATE and DELETE
-- ----------------------------------------------------------

-- Enable RLS if not already enabled
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to be idempotent
DROP POLICY IF EXISTS "audit_logs_insert_only" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_all" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_no_update" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_no_delete" ON audit_logs;

-- Allow INSERT for all authenticated users
CREATE POLICY "audit_logs_insert_only"
    ON audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow SELECT for all authenticated users (read audit trail)
CREATE POLICY "audit_logs_select_all"
    ON audit_logs FOR SELECT
    TO authenticated
    USING (true);

-- Explicitly DENY UPDATE (no policy = denied by default with RLS, but be explicit)
CREATE POLICY "audit_logs_no_update"
    ON audit_logs FOR UPDATE
    TO authenticated
    USING (false);

-- Explicitly DENY DELETE
CREATE POLICY "audit_logs_no_delete"
    ON audit_logs FOR DELETE
    TO authenticated
    USING (false);

-- ----------------------------------------------------------
-- 3. Trigger to prevent mutation even from service_role
-- ----------------------------------------------------------

CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log records are immutable — UPDATE/DELETE operations are not permitted';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_update ON audit_logs;
CREATE TRIGGER trg_prevent_audit_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

DROP TRIGGER IF EXISTS trg_prevent_audit_delete ON audit_logs;
CREATE TRIGGER trg_prevent_audit_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
