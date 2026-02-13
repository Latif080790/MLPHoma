-- 009_timeline_progress_v3.sql

-- 1. TIMELINE / GANTT ENHANCEMENTS
-- Ensure base tables exist
CREATE TABLE IF NOT EXISTS timeline_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    duration INTEGER,
    progress NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'not_started',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS curva_s_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    week_number INTEGER,
    planned_progress NUMERIC DEFAULT 0,
    actual_progress NUMERIC DEFAULT 0,
    planned_cost NUMERIC DEFAULT 0,
    actual_cost NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support for Zoning, Resources, and Scenarios
ALTER TABLE timeline_tasks ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES price_zones(id); -- Link to Zone
ALTER TABLE timeline_tasks ADD COLUMN IF NOT EXISTS sequence_level INTEGER DEFAULT 0; -- For logic-based sequencing
ALTER TABLE timeline_tasks ADD COLUMN IF NOT EXISTS resource_count INTEGER DEFAULT 1; -- Jml Tim / Alat
ALTER TABLE timeline_tasks ADD COLUMN IF NOT EXISTS productivity_rate NUMERIC DEFAULT 1.0; -- Output per day
ALTER TABLE timeline_tasks ADD COLUMN IF NOT EXISTS scenario_type TEXT DEFAULT 'normal'; -- 'normal', 'best', 'worst'
ALTER TABLE timeline_tasks ADD COLUMN IF NOT EXISTS weather_sensitive BOOLEAN DEFAULT FALSE; -- Is approved to be delayed by rain?

-- 2. PROGRESS & EVIDENCE (Quality Control)
-- Ensure base table exists
CREATE TABLE IF NOT EXISTS progress_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    progress_percentage NUMERIC DEFAULT 0,
    actual_cost NUMERIC DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Upgrade progress_logs to be 'Evidence-Based'
ALTER TABLE progress_logs ADD COLUMN IF NOT EXISTS volume_daily NUMERIC; -- Input Volume (not %)
ALTER TABLE progress_logs ADD COLUMN IF NOT EXISTS evidence_url TEXT; -- Foto Lapangan
ALTER TABLE progress_logs ADD COLUMN IF NOT EXISTS gps_coordinates TEXT; -- Lat,Long
ALTER TABLE progress_logs ADD COLUMN IF NOT EXISTS qc_status TEXT DEFAULT 'pending'; -- 'pending', 'approved', 'rejected'
ALTER TABLE progress_logs ADD COLUMN IF NOT EXISTS weather_condition TEXT; -- 'sunny', 'rain_light', 'rain_heavy'
ALTER TABLE progress_logs ADD COLUMN IF NOT EXISTS delay_reason TEXT; -- 'material', 'alat', 'lahan', 'cuaca'

-- 3. S-CURVE / FINANCIAL
-- Add snapshot fields for Tri-Line Curve
ALTER TABLE curva_s_points ADD COLUMN IF NOT EXISTS actual_cash_flow NUMERIC DEFAULT 0; -- Uang Keluar (Financial)
ALTER TABLE curva_s_points ADD COLUMN IF NOT EXISTS earned_value NUMERIC DEFAULT 0; -- EV for CPI calc

-- 4. WEATHER LOGS (New Table)
CREATE TABLE IF NOT EXISTS weather_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    condition TEXT NOT NULL, -- 'sunny', 'rainy'
    duration_hours NUMERIC DEFAULT 0,
    impact_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
