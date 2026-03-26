-- ============================================================================
-- Migration 053: Audit Triggers for Finance Tables
-- ============================================================================
-- Extends the immutable audit logging (log_immutable_audit) defined in
-- migration 051 to cover the new finance module tables.
-- ============================================================================

-- Attach audit trigger to finance_invoices
DROP TRIGGER IF EXISTS audit_finance_invoices ON finance_invoices;
CREATE TRIGGER audit_finance_invoices
    AFTER INSERT OR UPDATE OR DELETE ON finance_invoices
    FOR EACH ROW EXECUTE FUNCTION log_immutable_audit();

-- Attach audit trigger to finance_claims
DROP TRIGGER IF EXISTS audit_finance_claims ON finance_claims;
CREATE TRIGGER audit_finance_claims
    AFTER INSERT OR UPDATE OR DELETE ON finance_claims
    FOR EACH ROW EXECUTE FUNCTION log_immutable_audit();

-- Attach audit trigger to finance_transactions
DROP TRIGGER IF EXISTS audit_finance_transactions ON finance_transactions;
CREATE TRIGGER audit_finance_transactions
    AFTER INSERT OR UPDATE OR DELETE ON finance_transactions
    FOR EACH ROW EXECUTE FUNCTION log_immutable_audit();
