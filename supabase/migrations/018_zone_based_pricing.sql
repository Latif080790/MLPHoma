-- Migration: 018_zone_based_pricing.sql
-- Description: Adds support for Multi-Zone Pricing in AHSP.

-- 1. Create Zones Table
CREATE TABLE IF NOT EXISTS public.zones (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Create AHSP Zone Prices Table
-- Stores overrides for specific AHSP items in specific zones.
-- If a record exists, it overrides the base price.
CREATE TABLE IF NOT EXISTS public.ahsp_zone_prices (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  ahsp_id uuid REFERENCES public.ahsp_items(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.zones(id) ON DELETE CASCADE,
  
  -- Split Costs (Overrides)
  price_material numeric DEFAULT 0,
  price_labor numeric DEFAULT 0,
  price_equipment numeric DEFAULT 0,
  price_subcon numeric DEFAULT 0,
  
  -- Validation / Metadata
  overhead_percentage numeric DEFAULT 0,
  profit_percentage numeric DEFAULT 0,
  
  -- Calculated Final
  final_price numeric GENERATED ALWAYS AS (
    (price_material + price_labor + price_equipment + price_subcon) * (1 + (overhead_percentage + profit_percentage) / 100)
  ) STORED,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure unique price per item per zone
  UNIQUE(ahsp_id, zone_id)
);

-- 3. Add Zone Link to Projects
-- Projects can now be assigned to a specific Zone.
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES public.zones(id);

-- 4. RLS Policies
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Global Zone Access" ON public.zones;
CREATE POLICY "Global Zone Access" ON public.zones FOR ALL USING (true);

ALTER TABLE public.ahsp_zone_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Global Zone Price Access" ON public.ahsp_zone_prices;
CREATE POLICY "Global Zone Price Access" ON public.ahsp_zone_prices FOR ALL USING (true);


