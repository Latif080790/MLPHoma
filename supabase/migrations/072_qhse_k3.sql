-- Migration 072: QHSE/K3 Module
-- Safety Incidents, HSE Inspections, IBPR (Hazard Identification & Risk Assessment)

-- ── Safety Incidents ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS safety_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    incident_number TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('NEAR_MISS', 'FIRST_AID', 'MEDICAL_TREATMENT', 'LOST_TIME', 'FATALITY', 'PROPERTY_DAMAGE', 'ENVIRONMENTAL')),
    severity TEXT NOT NULL DEFAULT 'LOW' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status TEXT NOT NULL DEFAULT 'REPORTED' CHECK (status IN ('REPORTED', 'UNDER_INVESTIGATION', 'CORRECTIVE_ACTION', 'CLOSED')),
    incident_date TIMESTAMPTZ NOT NULL,
    location TEXT,
    reported_by TEXT,
    injured_person TEXT,
    injury_type TEXT,
    root_cause TEXT,
    corrective_actions TEXT,
    preventive_measures TEXT,
    lost_time_days INTEGER DEFAULT 0,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, incident_number)
);

-- ── HSE Inspections ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hse_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    inspection_number TEXT NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'ROUTINE' CHECK (type IN ('ROUTINE', 'SPECIAL', 'AUDIT', 'THIRD_PARTY')),
    status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'FAILED')),
    scheduled_date DATE NOT NULL,
    completed_date DATE,
    inspector TEXT,
    area TEXT,
    checklist JSONB DEFAULT '[]',
    findings JSONB DEFAULT '[]',
    score NUMERIC(5, 2),
    max_score NUMERIC(5, 2) DEFAULT 100,
    action_items JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, inspection_number)
);

-- ── IBPR (Identifikasi Bahaya & Penilaian Risiko) ──────────────────────────
CREATE TABLE IF NOT EXISTS ibpr_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    activity TEXT NOT NULL,
    hazard TEXT NOT NULL,
    hazard_type TEXT NOT NULL CHECK (hazard_type IN ('PHYSICAL', 'CHEMICAL', 'BIOLOGICAL', 'ERGONOMIC', 'PSYCHOSOCIAL', 'ELECTRICAL', 'MECHANICAL')),
    potential_risk TEXT NOT NULL,
    likelihood INTEGER NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
    severity INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 5),
    risk_score INTEGER GENERATED ALWAYS AS (likelihood * severity) STORED,
    risk_level TEXT GENERATED ALWAYS AS (
        CASE
            WHEN likelihood * severity >= 15 THEN 'CRITICAL'
            WHEN likelihood * severity >= 9  THEN 'HIGH'
            WHEN likelihood * severity >= 4  THEN 'MEDIUM'
            ELSE 'LOW'
        END
    ) STORED,
    control_measures TEXT,
    residual_likelihood INTEGER CHECK (residual_likelihood BETWEEN 1 AND 5),
    residual_severity INTEGER CHECK (residual_severity BETWEEN 1 AND 5),
    responsible_person TEXT,
    review_date DATE,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MITIGATED', 'ACCEPTED', 'ELIMINATED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_safety_incidents_project ON safety_incidents(project_id);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_type ON safety_incidents(project_id, type, severity);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_date ON safety_incidents(project_id, incident_date DESC);
CREATE INDEX IF NOT EXISTS idx_hse_inspections_project ON hse_inspections(project_id);
CREATE INDEX IF NOT EXISTS idx_hse_inspections_scheduled ON hse_inspections(project_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_ibpr_project ON ibpr_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_ibpr_risk_level ON ibpr_entries(project_id, risk_level);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE safety_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE hse_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ibpr_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "safety_incidents_auth" ON safety_incidents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "hse_inspections_auth" ON hse_inspections FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ibpr_entries_auth" ON ibpr_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
