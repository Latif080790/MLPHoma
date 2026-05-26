-- Migration 078: Contract Management
-- Adds contracts + variation_orders tables.
-- Apply via: supabase db push OR paste into Supabase SQL Editor

-- ============================================================
-- 1. contracts
-- ============================================================

CREATE TABLE IF NOT EXISTS contracts (
    id                   TEXT PRIMARY KEY,
    project_id           TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    contract_number      TEXT NOT NULL,
    title                TEXT NOT NULL,
    type                 TEXT NOT NULL DEFAULT 'LUMP_SUM',
    status               TEXT NOT NULL DEFAULT 'DRAFT',

    party_name           TEXT NOT NULL,
    party_role           TEXT NOT NULL DEFAULT 'CONTRACTOR',
    party_contact        TEXT,

    original_value       NUMERIC(18,2) NOT NULL DEFAULT 0,
    current_value        NUMERIC(18,2) NOT NULL DEFAULT 0,
    retention_pct        NUMERIC(5,2)  NOT NULL DEFAULT 5,
    advance_payment_pct  NUMERIC(5,2)  NOT NULL DEFAULT 0,

    start_date           DATE NOT NULL,
    end_date             DATE NOT NULL,
    actual_end_date      DATE,

    description          TEXT,
    scope_of_work        TEXT,
    attachment_urls      TEXT[] DEFAULT '{}',

    created_by           UUID REFERENCES auth.users(id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT contracts_status_check CHECK (
        status IN ('DRAFT','ACTIVE','AMENDED','SUSPENDED','COMPLETED','TERMINATED')
    ),
    CONSTRAINT contracts_type_check CHECK (
        type IN ('LUMP_SUM','UNIT_PRICE','COST_PLUS','GUARANTEED_MAXIMUM')
    ),
    CONSTRAINT contracts_party_role_check CHECK (
        party_role IN ('OWNER','CONTRACTOR','SUBCONTRACTOR','CONSULTANT')
    )
);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contracts_project_member_select"
    ON contracts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id = contracts.project_id
              AND user_id = auth.uid()
        )
    );

CREATE POLICY "contracts_project_member_insert"
    ON contracts FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id = contracts.project_id
              AND user_id = auth.uid()
        )
    );

CREATE POLICY "contracts_project_member_update"
    ON contracts FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id = contracts.project_id
              AND user_id = auth.uid()
        )
    );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contracts_project     ON contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status      ON contracts(project_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_party_role  ON contracts(project_id, party_role);

-- Auto updated_at
CREATE OR REPLACE FUNCTION fn_contracts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_contracts_updated_at ON contracts;
CREATE TRIGGER trg_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION fn_contracts_updated_at();

-- ============================================================
-- 2. variation_orders
-- ============================================================

CREATE TABLE IF NOT EXISTS variation_orders (
    id                   TEXT PRIMARY KEY,
    contract_id          TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    project_id           TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    vo_number            TEXT NOT NULL,
    title                TEXT NOT NULL,
    description          TEXT,

    value_change         NUMERIC(18,2) NOT NULL DEFAULT 0,
    schedule_change_days INT          NOT NULL DEFAULT 0,

    status               TEXT NOT NULL DEFAULT 'DRAFT',
    submitted_at         TIMESTAMPTZ,
    approved_at          TIMESTAMPTZ,
    approved_by          UUID REFERENCES auth.users(id),
    rejection_reason     TEXT,

    created_by           UUID REFERENCES auth.users(id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT variation_orders_status_check CHECK (
        status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED')
    )
);

ALTER TABLE variation_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "variation_orders_project_member_select"
    ON variation_orders FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id = variation_orders.project_id
              AND user_id = auth.uid()
        )
    );

CREATE POLICY "variation_orders_project_member_insert"
    ON variation_orders FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id = variation_orders.project_id
              AND user_id = auth.uid()
        )
    );

CREATE POLICY "variation_orders_project_member_update"
    ON variation_orders FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id = variation_orders.project_id
              AND user_id = auth.uid()
        )
    );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_variation_orders_contract ON variation_orders(contract_id);
CREATE INDEX IF NOT EXISTS idx_variation_orders_project  ON variation_orders(project_id, status);

-- Auto updated_at
CREATE OR REPLACE FUNCTION fn_variation_orders_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_variation_orders_updated_at ON variation_orders;
CREATE TRIGGER trg_variation_orders_updated_at
    BEFORE UPDATE ON variation_orders
    FOR EACH ROW EXECUTE FUNCTION fn_variation_orders_updated_at();
