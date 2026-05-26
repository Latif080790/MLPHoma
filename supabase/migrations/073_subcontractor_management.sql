-- Migration 073: Subcontractor Management
-- Tables: subcontractors, subcontracts, subcontract_progress, subcontract_retention

-- ── Subcontractors (vendor registry) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subcontractors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    npwp TEXT,
    qualification_grade TEXT CHECK (qualification_grade IN ('K1','K2','K3','M1','M2','B1','B2')),
    specialization TEXT[],
    performance_rating NUMERIC(3,1) CHECK (performance_rating BETWEEN 0 AND 5),
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Subcontracts (work packages) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subcontracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    subcontractor_id UUID NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
    contract_number TEXT NOT NULL,
    scope_description TEXT NOT NULL,
    contract_value NUMERIC(18,2) NOT NULL DEFAULT 0,
    start_date DATE,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','ACTIVE','SUSPENDED','COMPLETED','TERMINATED')),
    retention_percentage NUMERIC(5,2) NOT NULL DEFAULT 5.0,
    retention_released NUMERIC(18,2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    wbs_item_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Subcontract Progress Claims ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subcontract_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subcontract_id UUID NOT NULL REFERENCES subcontracts(id) ON DELETE CASCADE,
    claim_date DATE NOT NULL,
    claim_number TEXT NOT NULL,
    progress_percentage NUMERIC(5,2) NOT NULL CHECK (progress_percentage BETWEEN 0 AND 100),
    claimed_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    approved_amount NUMERIC(18,2),
    retention_deducted NUMERIC(18,2) NOT NULL DEFAULT 0,
    net_payment NUMERIC(18,2) GENERATED ALWAYS AS (
        COALESCE(approved_amount, claimed_amount) - retention_deducted
    ) STORED,
    status TEXT NOT NULL DEFAULT 'SUBMITTED'
        CHECK (status IN ('SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','PAID')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subcontractors_project ON subcontractors(project_id);
CREATE INDEX IF NOT EXISTS idx_subcontracts_project ON subcontracts(project_id);
CREATE INDEX IF NOT EXISTS idx_subcontracts_subcontractor ON subcontracts(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_subcontract_progress_contract ON subcontract_progress(subcontract_id);
CREATE INDEX IF NOT EXISTS idx_subcontract_progress_status ON subcontract_progress(status);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontract_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subcontractors_project_member" ON subcontractors
    FOR ALL USING (is_project_member_by_text(project_id, auth.uid()));

CREATE POLICY "subcontracts_project_member" ON subcontracts
    FOR ALL USING (is_project_member_by_text(project_id, auth.uid()));

CREATE POLICY "subcontract_progress_via_contract" ON subcontract_progress
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM subcontracts sc
            WHERE sc.id = subcontract_id
            AND is_project_member_by_text(sc.project_id, auth.uid())
        )
    );
