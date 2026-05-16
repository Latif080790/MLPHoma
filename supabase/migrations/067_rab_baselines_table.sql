-- Migration 067: RAB Baselines Table
-- Migrates baseline storage from localStorage to Supabase
-- for data persistence and multi-device access

CREATE TABLE IF NOT EXISTS rab_baselines (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    frozen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    item_count INTEGER NOT NULL DEFAULT 0,
    total_cost NUMERIC NOT NULL DEFAULT 0,
    items JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one baseline per project
CREATE UNIQUE INDEX IF NOT EXISTS rab_baselines_project_unique
    ON rab_baselines (project_id);

-- Performance index
CREATE INDEX IF NOT EXISTS rab_baselines_project_id_idx
    ON rab_baselines (project_id);

-- RLS
ALTER TABLE rab_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_members_can_view_baselines"
    ON rab_baselines FOR SELECT
    USING (is_project_member_by_text(project_id));

CREATE POLICY "project_managers_can_manage_baselines"
    ON rab_baselines FOR ALL
    USING (is_project_member_by_text(project_id))
    WITH CHECK (is_project_member_by_text(project_id));

-- Ensure update_updated_at_column helper exists (idempotent)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at trigger
CREATE TRIGGER rab_baselines_updated_at
    BEFORE UPDATE ON rab_baselines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
