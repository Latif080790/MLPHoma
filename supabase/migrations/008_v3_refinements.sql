-- 008_v3_refinements.sql

-- 1. PRICE ZONES (AHSP)
CREATE TABLE IF NOT EXISTS price_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default zones
INSERT INTO price_zones (code, name) VALUES 
('Z01', 'Jakarta & Jabodetabek'), 
('Z02', 'Jawa & Bali'), 
('Z03', 'Sumatera'),
('Z04', 'Kalimantan'),
('Z05', 'Sulawesi & Papua')
ON CONFLICT (code) DO NOTHING;

-- Add zone_id to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES price_zones(id);

-- 2. AHSP PRICE HISTORY (Living Data)
CREATE TABLE IF NOT EXISTS ahsp_price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ahsp_id UUID REFERENCES ahsp_items(id) ON DELETE CASCADE,
    price_material NUMERIC DEFAULT 0,
    price_labor NUMERIC DEFAULT 0,
    price_equipment NUMERIC DEFAULT 0,
    price_subcon NUMERIC DEFAULT 0,
    source_type TEXT, -- 'MANUAL', 'PO', 'SURVEY'
    source_ref_id UUID, -- Reference to PO ID or Survey ID
    zone_id UUID REFERENCES price_zones(id),
    effective_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RAB ENHANCEMENTS (TKDN & Metadata)
ALTER TABLE rab_items ADD COLUMN IF NOT EXISTS tkdn_percentage NUMERIC DEFAULT 0;
ALTER TABLE rab_items ADD COLUMN IF NOT EXISTS brand_ref TEXT; -- Merk/Spesifikasi
ALTER TABLE rab_items ADD COLUMN IF NOT EXISTS is_pareto BOOLEAN DEFAULT FALSE; -- 20% Top Cost

-- 4. SNAPSHOT / LOCKING SUPPORT
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_contract_signed BOOLEAN DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contract_signed_at TIMESTAMPTZ;

-- Function to Lock Project
CREATE OR REPLACE FUNCTION lock_project_contract(proj_id UUID) 
RETURNS VOID AS $$
BEGIN
    UPDATE projects 
    SET is_contract_signed = TRUE, contract_signed_at = NOW() 
    WHERE id = proj_id;
END;
$$ LANGUAGE plpgsql;
