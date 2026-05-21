-- Migration 080: QHSE Corrective Action Tracking
-- Dedicated table for corrective actions linked to incidents / inspections / IBPR.
-- Apply via: supabase db push OR paste into Supabase SQL Editor

CREATE TABLE IF NOT EXISTS qhse_corrective_actions (
    id               TEXT PRIMARY KEY,
    project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    ca_number        TEXT NOT NULL,
    title            TEXT NOT NULL,
    description      TEXT,

    source           TEXT NOT NULL DEFAULT 'MANUAL',
    source_id        TEXT,   -- FK to safety_incidents.id / hse_inspections.id / ibpr_entries.id
    source_ref       TEXT,   -- human-readable reference e.g. "INC-2601-0042"

    status           TEXT NOT NULL DEFAULT 'OPEN',
    priority         TEXT NOT NULL DEFAULT 'MEDIUM',

    assigned_to      UUID REFERENCES auth.users(id),
    assigned_to_name TEXT,

    due_date         DATE NOT NULL,
    completed_date   DATE,
    verified_date    DATE,
    verified_by      TEXT,

    evidence_urls    TEXT[]  DEFAULT '{}',
    closure_notes    TEXT,

    created_by       UUID REFERENCES auth.users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ca_status_check CHECK (
        status IN ('OPEN','IN_PROGRESS','PENDING_VERIFICATION','VERIFIED','CLOSED','OVERDUE')
    ),
    CONSTRAINT ca_source_check CHECK (
        source IN ('INCIDENT','INSPECTION','IBPR','AUDIT','MANUAL')
    ),
    CONSTRAINT ca_priority_check CHECK (
        priority IN ('LOW','MEDIUM','HIGH','CRITICAL')
    )
);

ALTER TABLE qhse_corrective_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ca_project_member_select"
    ON qhse_corrective_actions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id = qhse_corrective_actions.project_id
              AND user_id = auth.uid()
        )
    );

CREATE POLICY "ca_project_member_insert"
    ON qhse_corrective_actions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id = qhse_corrective_actions.project_id
              AND user_id = auth.uid()
        )
    );

CREATE POLICY "ca_project_member_update"
    ON qhse_corrective_actions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id = qhse_corrective_actions.project_id
              AND user_id = auth.uid()
        )
    );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ca_project_status ON qhse_corrective_actions(project_id, status);
CREATE INDEX IF NOT EXISTS idx_ca_project_due    ON qhse_corrective_actions(project_id, due_date);
CREATE INDEX IF NOT EXISTS idx_ca_assigned_to    ON qhse_corrective_actions(assigned_to, status)
    WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ca_source         ON qhse_corrective_actions(source, source_id)
    WHERE source_id IS NOT NULL;

-- Auto updated_at
CREATE OR REPLACE FUNCTION fn_ca_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_ca_updated_at ON qhse_corrective_actions;
CREATE TRIGGER trg_ca_updated_at
    BEFORE UPDATE ON qhse_corrective_actions
    FOR EACH ROW EXECUTE FUNCTION fn_ca_updated_at();

-- pg_cron: auto-mark overdue corrective actions (hourly)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('ca-overdue-check');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'ca-overdue-check',
      '30 * * * *',
      $cron$
        UPDATE qhse_corrective_actions
        SET status = 'OVERDUE', updated_at = NOW()
        WHERE status IN ('OPEN', 'IN_PROGRESS')
          AND due_date < CURRENT_DATE;
      $cron$
    );
  END IF;
END;
$$;
