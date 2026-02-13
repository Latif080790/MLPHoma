-- 011_fix_ahsp_permissions.sql

-- 0. ENSURE TABLES EXIST (Missing Tables Fix)

-- Resources (Master Data: Material, Labor, Equipment)
CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('MATERIAL', 'LABOR', 'EQUIPMENT', 'SUBCONTRACTOR')),
    unit TEXT NOT NULL,
    unit_price NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    supplier TEXT,
    specifications TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AHSP Items (Analisa Harga Satuan Pekerjaan Header)
CREATE TABLE IF NOT EXISTS ahsp_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    base_price NUMERIC DEFAULT 0, -- Total of components
    final_price NUMERIC DEFAULT 0, -- After Overhead & Profit
    overhead_percentage NUMERIC DEFAULT 10,
    profit_percentage NUMERIC DEFAULT 10,
    price_material NUMERIC DEFAULT 0,
    price_labor NUMERIC DEFAULT 0,
    price_equipment NUMERIC DEFAULT 0,
    price_subcon NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AHSP Components (Ingredients: Resource x Coefficient)
CREATE TABLE IF NOT EXISTS ahsp_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ahsp_id UUID REFERENCES ahsp_items(id) ON DELETE CASCADE,
    resource_id UUID REFERENCES resources(id) ON DELETE RESTRICT,
    coefficient NUMERIC NOT NULL DEFAULT 0,
    unit_price NUMERIC NOT NULL DEFAULT 0, -- Snapshot at entry
    subtotal NUMERIC NOT NULL DEFAULT 0,
    type TEXT NOT NULL, -- Cached from resource type
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AHSP Price History
CREATE TABLE IF NOT EXISTS ahsp_price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ahsp_id UUID REFERENCES ahsp_items(id) ON DELETE CASCADE,
    old_price NUMERIC,
    new_price NUMERIC,
    change_type TEXT,
    change_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for AHSP related tables
ALTER TABLE IF EXISTS resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ahsp_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ahsp_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ahsp_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS price_zones ENABLE ROW LEVEL SECURITY;

-- 1. RESOURCES
DROP POLICY IF EXISTS "Enable read access for all users" ON resources;
CREATE POLICY "Enable read access for all users" ON resources FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON resources;
CREATE POLICY "Enable insert for authenticated users only" ON resources FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable update for authenticated users only" ON resources;
CREATE POLICY "Enable update for authenticated users only" ON resources FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON resources;
CREATE POLICY "Enable delete for authenticated users only" ON resources FOR DELETE USING (auth.role() = 'authenticated');

-- 2. AHSP ITEMS
DROP POLICY IF EXISTS "Enable read access for all users" ON ahsp_items;
CREATE POLICY "Enable read access for all users" ON ahsp_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON ahsp_items;
CREATE POLICY "Enable all access for authenticated users" ON ahsp_items FOR ALL USING (auth.role() = 'authenticated');

-- 3. AHSP COMPONENTS
DROP POLICY IF EXISTS "Enable read access for all users" ON ahsp_components;
CREATE POLICY "Enable read access for all users" ON ahsp_components FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON ahsp_components;
CREATE POLICY "Enable all access for authenticated users" ON ahsp_components FOR ALL USING (auth.role() = 'authenticated');

-- 4. AHSP PRICE HISTORY
DROP POLICY IF EXISTS "Enable read access for all users" ON ahsp_price_history;
CREATE POLICY "Enable read access for all users" ON ahsp_price_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON ahsp_price_history;
CREATE POLICY "Enable all access for authenticated users" ON ahsp_price_history FOR ALL USING (auth.role() = 'authenticated');

-- 5. PRICE ZONES
DROP POLICY IF EXISTS "Enable read access for all users" ON price_zones;
CREATE POLICY "Enable read access for all users" ON price_zones FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON price_zones;
CREATE POLICY "Enable all access for authenticated users" ON price_zones FOR ALL USING (auth.role() = 'authenticated');
