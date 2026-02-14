-- ============================================================
-- Migration 030: FASE 3+4 Schema Extensions
-- Progress Evidence, Document Versioning, Project Members,
-- SPK computed columns, and miscellaneous improvements
-- ============================================================

-- 1. Progress Evidence Table (GPS + Photo Validation)
CREATE TABLE IF NOT EXISTS progress_evidence (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    progress_date DATE NOT NULL,
    photo_url TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    captured_at TIMESTAMPTZ,
    device_info TEXT,
    distance_from_site DOUBLE PRECISION,
    validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('valid', 'warning', 'invalid', 'pending')),
    validation_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_progress_evidence_project ON progress_evidence(project_id);
CREATE INDEX IF NOT EXISTS idx_progress_evidence_date ON progress_evidence(progress_date);

ALTER TABLE progress_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own project evidence" ON progress_evidence
    FOR ALL USING (auth.uid() IS NOT NULL);

-- 2. Document Versioning Columns
-- Add versioning support to existing documents table
DO $$ BEGIN
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_group_id UUID;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS change_notes TEXT;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS uploaded_by TEXT;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_latest BOOLEAN DEFAULT TRUE;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size BIGINT;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type TEXT;
EXCEPTION WHEN undefined_table THEN
    -- documents table doesn't exist yet, create it with all columns
    CREATE TABLE documents (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        document_group_id UUID,
        category TEXT DEFAULT 'General',
        title TEXT NOT NULL,
        file_url TEXT NOT NULL,
        version_number INTEGER DEFAULT 1,
        change_notes TEXT,
        uploaded_by TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        is_latest BOOLEAN DEFAULT TRUE,
        file_size BIGINT,
        mime_type TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX idx_documents_project ON documents(project_id);
    CREATE INDEX idx_documents_group ON documents(document_group_id);
    
    ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can manage project documents" ON documents
        FOR ALL USING (auth.uid() IS NOT NULL);
END $$;

-- 3. Project Members Table (per-project role assignments)
CREATE TABLE IF NOT EXISTS project_members (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    project_role TEXT DEFAULT 'user' CHECK (project_role IN ('admin', 'manager', 'user', 'viewer')),
    assigned_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view project memberships" ON project_members
    FOR ALL USING (auth.uid() IS NOT NULL);

-- 4. Work Orders: Add computed/additional columns
DO $$ BEGIN
    ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS max_amount NUMERIC DEFAULT 0;
    ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS actual_amount NUMERIC DEFAULT 0;
    ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS remaining_payment NUMERIC DEFAULT 0;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- 5. Profiles: Add additional fields
DO $$ BEGIN
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- 6. Projects: Ensure metadata column exists for scenario storage
DO $$ BEGIN
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS contract_value NUMERIC;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- 7. RAB items: Ensure price override columns exist
DO $$ BEGIN
    ALTER TABLE rab_items ADD COLUMN IF NOT EXISTS ahsp_id UUID;
    ALTER TABLE rab_items ADD COLUMN IF NOT EXISTS wbs_id UUID;
    ALTER TABLE rab_items ADD COLUMN IF NOT EXISTS total_price NUMERIC;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- 8. Trigger: Auto-compute work order amounts
CREATE OR REPLACE FUNCTION compute_work_order_amounts()
RETURNS TRIGGER AS $$
BEGIN
    NEW.max_amount := COALESCE(NEW.unit_price, 0) * COALESCE(NEW.max_volume, 0);
    NEW.actual_amount := COALESCE(NEW.unit_price, 0) * COALESCE(NEW.actual_volume, 0);
    NEW.remaining_payment := NEW.actual_amount - COALESCE(NEW.paid_amount, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compute_work_order_amounts ON work_orders;
CREATE TRIGGER trg_compute_work_order_amounts
    BEFORE INSERT OR UPDATE ON work_orders
    FOR EACH ROW
    EXECUTE FUNCTION compute_work_order_amounts();
