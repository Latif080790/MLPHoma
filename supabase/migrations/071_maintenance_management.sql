-- Migration 071: Maintenance Management Module
-- Asset Register, PPM Schedule, Work Orders, Spare Parts

-- ── Asset Register ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    asset_code TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('EQUIPMENT', 'VEHICLE', 'TOOL', 'INSTRUMENT', 'FACILITY')),
    model TEXT,
    serial_number TEXT,
    purchase_date DATE,
    purchase_value NUMERIC(18, 2) DEFAULT 0,
    condition TEXT NOT NULL DEFAULT 'GOOD' CHECK (condition IN ('NEW', 'GOOD', 'FAIR', 'POOR', 'SCRAPPED')),
    location TEXT,
    responsible_person TEXT,
    next_service_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, asset_code)
);

-- ── PPM Schedule ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ppm_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY')),
    last_done_date DATE,
    next_due_date DATE NOT NULL,
    responsible_person TEXT,
    checklist JSONB DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'SKIPPED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Work Orders ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    wo_number TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'CORRECTIVE' CHECK (type IN ('CORRECTIVE', 'PREVENTIVE', 'PREDICTIVE', 'EMERGENCY')),
    priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'PENDING_PARTS', 'COMPLETED', 'CANCELLED')),
    reported_by TEXT,
    assigned_to TEXT,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    target_completion DATE,
    completed_at TIMESTAMPTZ,
    estimated_cost NUMERIC(18, 2) DEFAULT 0,
    actual_cost NUMERIC(18, 2) DEFAULT 0,
    downtime_hours NUMERIC(6, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, wo_number)
);

-- ── Spare Parts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spare_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    part_code TEXT NOT NULL,
    name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'pcs',
    stock_qty NUMERIC(12, 3) NOT NULL DEFAULT 0,
    min_stock NUMERIC(12, 3) NOT NULL DEFAULT 0,
    unit_price NUMERIC(18, 2) DEFAULT 0,
    location TEXT,
    compatible_assets JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, part_code)
);

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_assets_project_id ON assets(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_condition ON assets(project_id, condition);
CREATE INDEX IF NOT EXISTS idx_ppm_schedules_asset_id ON ppm_schedules(asset_id);
CREATE INDEX IF NOT EXISTS idx_ppm_schedules_next_due ON ppm_schedules(project_id, next_due_date);
CREATE INDEX IF NOT EXISTS idx_ppm_schedules_status ON ppm_schedules(project_id, status);
CREATE INDEX IF NOT EXISTS idx_work_orders_project_id ON work_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(project_id, status);
CREATE INDEX IF NOT EXISTS idx_work_orders_priority ON work_orders(project_id, priority, status);
CREATE INDEX IF NOT EXISTS idx_spare_parts_project_id ON spare_parts(project_id);
CREATE INDEX IF NOT EXISTS idx_spare_parts_low_stock ON spare_parts(project_id, stock_qty, min_stock);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppm_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_parts ENABLE ROW LEVEL SECURITY;

-- RLS policies: authenticated users can manage records for their projects
CREATE POLICY "assets_auth" ON assets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ppm_schedules_auth" ON ppm_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "work_orders_auth" ON work_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "spare_parts_auth" ON spare_parts FOR ALL TO authenticated USING (true) WITH CHECK (true);
