-- Migration 029: Notification Engine + Approval Workflow + Audit Trail Activation
-- Implements Fase 1 of MLPHoma Masterplan Transformation

-- ============================================================
-- 1. NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    type TEXT NOT NULL CHECK (type IN (
        'BUDGET_WARNING',      -- Budget approaching limit
        'BUDGET_CRITICAL',     -- Budget exceeded
        'SCHEDULE_ALERT',      -- Schedule delay detected
        'SCHEDULE_REMINDER',   -- Upcoming task reminder (H-3)
        'APPROVAL_REQUEST',    -- Approval needed from user
        'APPROVAL_RESULT',     -- Approval approved/rejected
        'MATERIAL_ALERT',      -- Min stock, ghost delivery
        'TRANSFER_REQUEST',    -- Material transfer request
        'QUALITY_ALERT',       -- QC gate failure
        'CHANGE_ORDER',        -- VO/CCO notification
        'SYSTEM_INFO'          -- General system info
    )),
    
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    
    -- Metadata for action context (e.g., entity_type, entity_id, amounts, etc.)
    metadata JSONB DEFAULT '{}',
    
    -- Link to actionable entity
    entity_type TEXT,  -- 'PO', 'MR', 'TRANSFER', 'VO', 'TASK', etc.
    entity_id TEXT,
    
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_project ON notifications(project_id, created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert notifications" ON notifications
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- ============================================================
-- 2. APPROVAL REQUESTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS approval_requests (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    
    requester_id UUID REFERENCES auth.users(id),
    requester_name TEXT,
    
    -- What needs approval
    entity_type TEXT NOT NULL CHECK (entity_type IN (
        'PURCHASE_ORDER',
        'MATERIAL_TRANSFER',
        'BUDGET_OVERRIDE',
        'BUDGET_TRANSFER',
        'PAYMENT',
        'CHANGE_ORDER',
        'EMERGENCY_TRANSFER'
    )),
    entity_id TEXT NOT NULL,
    
    -- Who should approve (role-based)
    approver_role TEXT NOT NULL DEFAULT 'manager' CHECK (approver_role IN ('manager', 'admin')),
    
    -- Approval details
    title TEXT NOT NULL,
    description TEXT,
    
    -- Impact analysis data
    impact_summary JSONB DEFAULT '{}',
    -- Example: { "budget_impact": -500000, "source_wbs": "Kolom", "target_wbs": "Dinding", "warning": "3rd transfer this week" }
    
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    
    -- Resolution
    approved_by UUID REFERENCES auth.users(id),
    approver_name TEXT,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_requests_project ON approval_requests(project_id, status);

-- RLS
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view approvals" ON approval_requests
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert approvals" ON approval_requests
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Managers/admins can update approvals" ON approval_requests
    FOR UPDATE USING (auth.uid() IS NOT NULL);


-- ============================================================
-- 3. MATERIAL TRANSFER REQUESTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS material_transfer_requests (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    
    requester_id UUID REFERENCES auth.users(id),
    requester_name TEXT,
    
    source_wbs_id TEXT,
    source_wbs_name TEXT,
    target_wbs_id TEXT,
    target_wbs_name TEXT,
    
    item_name TEXT NOT NULL,
    item_id TEXT,  -- Optional link to inventory/material
    unit TEXT,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    
    -- Cost impact
    unit_cost NUMERIC DEFAULT 0,
    total_cost NUMERIC GENERATED ALWAYS AS (quantity * unit_cost) STORED,
    
    reason TEXT NOT NULL,
    is_emergency BOOLEAN DEFAULT FALSE,
    
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED')),
    
    -- Resolution
    approval_request_id TEXT REFERENCES approval_requests(id),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mtr_project ON material_transfer_requests(project_id, status);

-- RLS
ALTER TABLE material_transfer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage transfers" ON material_transfer_requests
    FOR ALL USING (auth.uid() IS NOT NULL);


-- ============================================================
-- 4. GOODS RECEIPT NOTES (GRN) TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS goods_receipts (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    po_id TEXT REFERENCES purchase_orders(id),
    
    grn_number TEXT NOT NULL,
    received_by UUID REFERENCES auth.users(id),
    receiver_name TEXT,
    received_date DATE NOT NULL,
    
    -- Items received (JSONB array for flexibility)
    items JSONB NOT NULL DEFAULT '[]',
    -- Example: [{ "po_item_id": "...", "item_name": "Semen", "qty_ordered": 50, "qty_received": 48, "unit": "sak", "notes": "2 sak rusak" }]
    
    photo_url TEXT,
    delivery_note_url TEXT,
    notes TEXT,
    
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grn_project ON goods_receipts(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_grn_po ON goods_receipts(po_id);

-- RLS
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage GRN" ON goods_receipts
    FOR ALL USING (auth.uid() IS NOT NULL);


-- ============================================================
-- 5. WORK ORDERS (SPK) TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS work_orders (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    
    spk_number TEXT NOT NULL,
    wbs_id TEXT,
    wbs_name TEXT,
    
    mandor_name TEXT NOT NULL,
    mandor_contact TEXT,
    
    scope_description TEXT NOT NULL,
    unit TEXT NOT NULL,
    unit_price NUMERIC NOT NULL,
    max_volume NUMERIC NOT NULL,
    max_amount NUMERIC GENERATED ALWAYS AS (unit_price * max_volume) STORED,
    
    actual_volume NUMERIC DEFAULT 0,
    actual_amount NUMERIC GENERATED ALWAYS AS (unit_price * actual_volume) STORED,
    
    -- Payment tracking
    paid_amount NUMERIC DEFAULT 0,
    remaining_payment NUMERIC GENERATED ALWAYS AS ((unit_price * actual_volume) - COALESCE(paid_amount, 0)) STORED,
    
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
    
    start_date DATE,
    end_date DATE,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_orders_project ON work_orders(project_id, status);

-- RLS
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage work orders" ON work_orders
    FOR ALL USING (auth.uid() IS NOT NULL);


-- ============================================================
-- 6. ADD COLUMNS TO EXISTING TABLES
-- ============================================================

-- RAB: Add snapshot_price and base/final price columns
ALTER TABLE rab_items ADD COLUMN IF NOT EXISTS base_price NUMERIC;
ALTER TABLE rab_items ADD COLUMN IF NOT EXISTS final_price NUMERIC;
ALTER TABLE rab_items ADD COLUMN IF NOT EXISTS snapshot_price JSONB;
-- snapshot_price stores: { "material": X, "labor": Y, "equipment": Z, "subcon": W, "snapshotted_at": "ISO date" }

-- Projects: Add target_profit_pct and coordinates
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_profit_pct NUMERIC DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- RAP: Add vendor_lock and transfer fields
ALTER TABLE rap_items ADD COLUMN IF NOT EXISTS locked_vendor_id TEXT;
ALTER TABLE rap_items ADD COLUMN IF NOT EXISTS locked_vendor_name TEXT;
ALTER TABLE rap_items ADD COLUMN IF NOT EXISTS volume_locked BOOLEAN DEFAULT FALSE;


-- ============================================================
-- 7. ENSURE AUDIT_LOGS TABLE IS PROPERLY STRUCTURED
-- ============================================================
-- audit_logs already exists from migration 005, ensure it has all needed columns
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

