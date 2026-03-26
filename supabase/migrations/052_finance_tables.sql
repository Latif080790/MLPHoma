-- ============================================================================
-- Migration 052: Finance Module Database Tables
-- ============================================================================
-- Creates core tables for the Finance module:
--   1. finance_invoices  — Accounts Payable (vendor invoices)
--   2. finance_claims    — Accounts Receivable (client progress claims)
--   3. finance_transactions — Journal ledger entries
-- ============================================================================

-- 1. Finance Invoices (AP)
CREATE TABLE IF NOT EXISTS finance_invoices (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    po_id       TEXT,  -- Optional link to supply_chain purchase orders

    vendor_name     TEXT NOT NULL,
    invoice_number  TEXT NOT NULL,
    description     TEXT,

    amount       NUMERIC(18,2) NOT NULL DEFAULT 0,
    tax_amount   NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,

    due_date     DATE NOT NULL,
    status       TEXT NOT NULL DEFAULT 'UNPAID'
                 CHECK (status IN ('UNPAID','PARTIAL','PAID','OVERDUE','PENDING_PAYMENT')),
    file_url     TEXT,

    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_invoices_project ON finance_invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_status  ON finance_invoices(status);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_due     ON finance_invoices(due_date);

-- 2. Finance Claims (AR)
CREATE TABLE IF NOT EXISTS finance_claims (
    id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    claim_number        TEXT NOT NULL,
    period_start        DATE,
    period_end          DATE,

    progress_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
    amount              NUMERIC(18,2) NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','PAID')),

    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_claims_project ON finance_claims(project_id);
CREATE INDEX IF NOT EXISTS idx_finance_claims_status  ON finance_claims(status);

-- 3. Finance Transactions (Journal)
CREATE TABLE IF NOT EXISTS finance_transactions (
    id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description      TEXT NOT NULL,
    category         TEXT NOT NULL DEFAULT 'OTHER',

    amount           NUMERIC(18,2) NOT NULL DEFAULT 0,

    reference_type   TEXT CHECK (reference_type IN ('INVOICE','CLAIM','OTHER')),
    reference_id     TEXT,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_txn_project ON finance_transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_finance_txn_date    ON finance_transactions(transaction_date);

-- ============================================================================
-- RLS Policies — project-member scoped access
-- ============================================================================

ALTER TABLE finance_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;

-- Invoices RLS
CREATE POLICY "finance_invoices_select" ON finance_invoices
    FOR SELECT USING (is_project_member_by_text(project_id));

CREATE POLICY "finance_invoices_insert" ON finance_invoices
    FOR INSERT WITH CHECK (is_project_member_by_text(project_id));

CREATE POLICY "finance_invoices_update" ON finance_invoices
    FOR UPDATE USING (is_project_member_by_text(project_id));

CREATE POLICY "finance_invoices_delete" ON finance_invoices
    FOR DELETE USING (is_project_member_by_text(project_id));

-- Claims RLS
CREATE POLICY "finance_claims_select" ON finance_claims
    FOR SELECT USING (is_project_member_by_text(project_id));

CREATE POLICY "finance_claims_insert" ON finance_claims
    FOR INSERT WITH CHECK (is_project_member_by_text(project_id));

CREATE POLICY "finance_claims_update" ON finance_claims
    FOR UPDATE USING (is_project_member_by_text(project_id));

CREATE POLICY "finance_claims_delete" ON finance_claims
    FOR DELETE USING (is_project_member_by_text(project_id));

-- Transactions RLS
CREATE POLICY "finance_txn_select" ON finance_transactions
    FOR SELECT USING (is_project_member_by_text(project_id));

CREATE POLICY "finance_txn_insert" ON finance_transactions
    FOR INSERT WITH CHECK (is_project_member_by_text(project_id));

CREATE POLICY "finance_txn_update" ON finance_transactions
    FOR UPDATE USING (is_project_member_by_text(project_id));

CREATE POLICY "finance_txn_delete" ON finance_transactions
    FOR DELETE USING (is_project_member_by_text(project_id));

-- ============================================================================
-- updated_at trigger (auto-set on UPDATE)
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_finance_invoices ON finance_invoices;
CREATE TRIGGER set_updated_at_finance_invoices
    BEFORE UPDATE ON finance_invoices
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_finance_claims ON finance_claims;
CREATE TRIGGER set_updated_at_finance_claims
    BEFORE UPDATE ON finance_claims
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_finance_transactions ON finance_transactions;
CREATE TRIGGER set_updated_at_finance_transactions
    BEFORE UPDATE ON finance_transactions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
