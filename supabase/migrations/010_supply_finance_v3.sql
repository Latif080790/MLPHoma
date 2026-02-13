-- 010_supply_finance_v3.sql

-- 1. SUPPLY CHAIN V3
-- Ensure base table exists
CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT, -- 'Material', 'Subcon', 'Equipment'
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendor Rating & Management
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS rating_score NUMERIC DEFAULT 0; -- 0-5 Stars
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS is_blacklisted BOOLEAN DEFAULT FALSE;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS blacklist_reason TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS top_days INTEGER DEFAULT 0; -- Term of Payment (Days)

-- RAP Link in Purchase Orders (Smart PO)
-- Ensure base tables exist
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id),
    po_number TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    total_amount NUMERIC DEFAULT 0,
    rap_reference_id UUID, -- Optional link to RAP Package
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    description TEXT,
    quantity NUMERIC DEFAULT 0,
    unit_price NUMERIC DEFAULT 0,
    total_price NUMERIC DEFAULT 0,
    rap_item_id UUID REFERENCES rap_items(id), -- Strict link to Budget Item
    budget_variance NUMERIC -- (PO Price - RAP Price)
);

CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT,
    quantity NUMERIC DEFAULT 0,
    unit TEXT,
    min_stock_level NUMERIC DEFAULT 0, -- Warn if below this
    lead_time_days INTEGER DEFAULT 0, -- For JIT Trigger
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Material Waste & Leftover
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS is_leftover BOOLEAN DEFAULT FALSE;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS original_project_id UUID REFERENCES projects(id); -- Source of leftover
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS fifo_batch_code TEXT; -- For FIFO tracking

-- SUPPLY CHAIN 4.0 NEW TABLES
-- 1. Transfer Notes (Inter-Project)
CREATE TABLE IF NOT EXISTS transfer_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_project_id UUID REFERENCES projects(id),
    to_project_id UUID REFERENCES projects(id),
    item_name TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, approved, completed
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Waste Logs (The Detective)
CREATE TABLE IF NOT EXISTS waste_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    material_name TEXT NOT NULL,
    theoretical_usage NUMERIC DEFAULT 0, -- From Progress
    actual_usage NUMERIC DEFAULT 0, -- From Warehouse Out
    waste_percentage NUMERIC GENERATED ALWAYS AS (
        CASE WHEN theoretical_usage > 0 THEN ((actual_usage - theoretical_usage) / theoretical_usage) * 100 ELSE 0 END
    ) STORED,
    status TEXT DEFAULT 'normal', -- normal, warning, critical
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Subcon Chargebacks (Penalty)
CREATE TABLE IF NOT EXISTS subcon_chargebacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    subcon_name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    reason TEXT NOT NULL, -- e.g. "Waste Besi 10%"
    date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'draft', -- draft, deducted
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. FINANCE V3
-- Invoicing & Retention
-- Ensure base tables exist
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'draft',
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    description TEXT,
    amount NUMERIC DEFAULT 0,
    date DATE,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS retention_amount NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS retention_percentage NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_retention_released BOOLEAN DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS linked_progress_log_id UUID REFERENCES progress_logs(id); -- Auto-Invoice Trigger Source

-- Expenses & AP
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS priority_level TEXT DEFAULT 'normal'; -- 'critical', 'high', 'normal', 'low'

-- CashFlow Projection (Runway)
CREATE TABLE IF NOT EXISTS cashflow_projections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    period_date DATE NOT NULL, -- Monthly/Weekly
    estimated_inflow NUMERIC DEFAULT 0,
    estimated_outflow NUMERIC DEFAULT 0,
    locked_commitments NUMERIC DEFAULT 0, -- From PO/Contracts
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
