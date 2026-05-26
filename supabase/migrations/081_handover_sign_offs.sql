-- Migration 081: Handover Sign-Offs
-- Stores per-stakeholder sign-off records for handover wizard.

CREATE TABLE IF NOT EXISTS handover_sign_offs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handover_id  TEXT NOT NULL,
    stakeholder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    signed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT handover_sign_offs_unique UNIQUE (handover_id, stakeholder_id)
);

ALTER TABLE handover_sign_offs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hso_select" ON handover_sign_offs
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "hso_insert" ON handover_sign_offs
    FOR INSERT WITH CHECK (auth.uid() = stakeholder_id);

CREATE POLICY "hso_update" ON handover_sign_offs
    FOR UPDATE USING (auth.uid() = stakeholder_id);

CREATE INDEX IF NOT EXISTS idx_hso_handover ON handover_sign_offs(handover_id);
CREATE INDEX IF NOT EXISTS idx_hso_stakeholder ON handover_sign_offs(stakeholder_id);

-- Auto updated_at
CREATE OR REPLACE FUNCTION fn_hso_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_hso_updated_at ON handover_sign_offs;
CREATE TRIGGER trg_hso_updated_at
    BEFORE UPDATE ON handover_sign_offs
    FOR EACH ROW EXECUTE FUNCTION fn_hso_updated_at();
