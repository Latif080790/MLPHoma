-- ==========================================
-- Add AHSP Price History Table
-- Purpose: Create missing ahsp_price_history table in production
-- ==========================================

-- Create the ahsp_price_history table
CREATE TABLE IF NOT EXISTS public.ahsp_price_history (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  ahsp_id text REFERENCES public.ahsp_items(id) ON DELETE CASCADE,
  zone_id uuid,
  
  -- Price snapshots
  old_price numeric,
  new_price numeric,
  
  -- Split costs
  price_material numeric DEFAULT 0,
  price_labor numeric DEFAULT 0,
  price_equipment numeric DEFAULT 0,
  price_subcon numeric DEFAULT 0,
  
  -- Change tracking
  change_type text, -- 'CREATE', 'UPDATE', 'DELETE'
  change_reason text,
  changed_by uuid,
  
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ahsp_price_history ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (development mode)
-- WARNING: In production, restrict this to authenticated users
DROP POLICY IF EXISTS "Allow public select ahsp_price_history" ON public.ahsp_price_history;
CREATE POLICY "Allow public select ahsp_price_history" 
  ON public.ahsp_price_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert ahsp_price_history" ON public.ahsp_price_history;
CREATE POLICY "Allow public insert ahsp_price_history" 
  ON public.ahsp_price_history FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update ahsp_price_history" ON public.ahsp_price_history;
CREATE POLICY "Allow public update ahsp_price_history" 
  ON public.ahsp_price_history FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete ahsp_price_history" ON public.ahsp_price_history;
CREATE POLICY "Allow public delete ahsp_price_history" 
  ON public.ahsp_price_history FOR DELETE USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_ahsp_price_history_ahsp_id 
  ON public.ahsp_price_history(ahsp_id);
  
CREATE INDEX IF NOT EXISTS idx_ahsp_price_history_zone_id 
  ON public.ahsp_price_history(zone_id);
  
CREATE INDEX IF NOT EXISTS idx_ahsp_price_history_created_at 
  ON public.ahsp_price_history(created_at DESC);

-- Add missing split cost columns to ahsp_items if they don't exist
ALTER TABLE public.ahsp_items
  ADD COLUMN IF NOT EXISTS price_material numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_labor numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_equipment numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_subcon numeric DEFAULT 0;
