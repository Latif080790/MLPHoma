-- Migration 079: Budget Revision Workflow
-- Apply via: supabase db push OR paste into Supabase SQL Editor

CREATE TABLE IF NOT EXISTS budget_revisions (
    id                   TEXT PRIMARY KEY,
    project_id           TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    revision_number      TEXT NOT NULL,
    title                TEXT NOT NULL,
    justification        TEXT NOT NULL,
    status               TEXT NOT NULL DEFAULT 'DRAFT',

    -- Revision line items stored as JSONB:
    -- [{ rabItemId, rabItemName, currentValue, newValue, delta, reason }]
    items                JSONB NOT NULL DEFAULT '[]',

    total_current_budget NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_new_budget     NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_delta          NUMERIC(18,2) NOT NULL DEFAULT 0,
    delta_percent        NUMERIC(8,4)  NOT NULL DEFAULT 0,

    requested_by         UUID REFERENCES auth.users(id),
    requester_name       TEXT,
    approved_by          UUID REFERENCES auth.users(id),
    approved_at          TIMESTAMPTZ,
    rejection_reason     TEXT,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT budget_revisions_status_check CHECK (
        status IN ('DRAFT','SUBMITTED','PENDING_APPROVAL','APPROVED','REJECTED')
    )
);

ALTER TABLE budget_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_revisions_project_member_select"
    ON budget_revisions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id = budget_revisions.project_id
              AND user_id = auth.uid()
        )
    );

CREATE POLICY "budget_revisions_project_member_write"
    ON budget_revisions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id = budget_revisions.project_id
              AND user_id = auth.uid()
        )
    );

CREATE POLICY "budget_revisions_project_member_update"
    ON budget_revisions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id = budget_revisions.project_id
              AND user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_budget_revisions_project ON budget_revisions(project_id, status);
CREATE INDEX IF NOT EXISTS idx_budget_revisions_status  ON budget_revisions(status, created_at DESC);

-- Auto updated_at
CREATE OR REPLACE FUNCTION fn_budget_revisions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_budget_revisions_updated_at ON budget_revisions;
CREATE TRIGGER trg_budget_revisions_updated_at
    BEFORE UPDATE ON budget_revisions
    FOR EACH ROW EXECUTE FUNCTION fn_budget_revisions_updated_at();

-- Add revision_id to rab_baselines if column doesn't exist yet
ALTER TABLE rab_baselines ADD COLUMN IF NOT EXISTS revision_id TEXT REFERENCES budget_revisions(id);
