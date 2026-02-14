-- Migration: 019_ahsp_history_and_refinement.sql
-- Description: Adds split cost columns to ahsp_items and creates ahsp_price_history table with triggers.

-- 1. Refine AHSP Items Table (Add Split Costs for Master Items)
ALTER TABLE public.ahsp_items
ADD COLUMN IF NOT EXISTS price_material numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_labor numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_equipment numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_subcon numeric DEFAULT 0;

-- 2. Create Price History Table
CREATE TABLE IF NOT EXISTS public.ahsp_price_history (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    ahsp_id uuid REFERENCES public.ahsp_items(id) ON DELETE CASCADE,
    zone_id uuid REFERENCES public.zones(id) ON DELETE CASCADE, -- NULL means Master Price
    
    -- Snapshot of Prices
    old_price numeric,
    new_price numeric,
    
    price_material numeric DEFAULT 0,
    price_labor numeric DEFAULT 0,
    price_equipment numeric DEFAULT 0,
    price_subcon numeric DEFAULT 0,
    
    change_type text, -- 'CREATE', 'UPDATE', 'DELETE'
    change_reason text, -- Optional user note
    changed_by uuid, --Ideally references auth.users(id)
    
    created_at timestamptz DEFAULT now()
);

-- 3. RLS Policies
ALTER TABLE public.ahsp_price_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Global History Access" ON public.ahsp_price_history;
CREATE POLICY "Global History Access" ON public.ahsp_price_history FOR ALL USING (true);

-- 4. Triggers for Automation

-- Trigger Function: Log AHSP Item Changes (Master)
CREATE OR REPLACE FUNCTION log_ahsp_price_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if price fields changed
    IF (OLD.final_price IS DISTINCT FROM NEW.final_price) OR
       (OLD.price_material IS DISTINCT FROM NEW.price_material) OR
       (OLD.price_labor IS DISTINCT FROM NEW.price_labor) OR
       (OLD.price_equipment IS DISTINCT FROM NEW.price_equipment) OR
       (OLD.price_subcon IS DISTINCT FROM NEW.price_subcon) THEN
       
        INSERT INTO public.ahsp_price_history (
            ahsp_id,
            zone_id,
            old_price,
            new_price,
            price_material,
            price_labor,
            price_equipment,
            price_subcon,
            change_type,
            changed_by
        ) VALUES (
            NEW.id,
            NULL, -- Master
            OLD.final_price,
            NEW.final_price,
            NEW.price_material,
            NEW.price_labor,
            NEW.price_equipment,
            NEW.price_subcon,
            'UPDATE',
            auth.uid()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ahsp_price_change ON public.ahsp_items;
CREATE TRIGGER trg_ahsp_price_change
AFTER UPDATE ON public.ahsp_items
FOR EACH ROW EXECUTE FUNCTION log_ahsp_price_change();

-- Trigger Function: Log Zone Price Changes
CREATE OR REPLACE FUNCTION log_zone_price_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
         INSERT INTO public.ahsp_price_history (
            ahsp_id,
            zone_id,
            old_price,
            new_price,
            price_material,
            price_labor,
            price_equipment,
            price_subcon,
            change_type,
            changed_by
        ) VALUES (
            NEW.ahsp_id,
            NEW.zone_id,
            0, -- Old price was effectively standard, but difficult to fetch here. 0 or NULL implies new override.
            NEW.final_price,
            NEW.price_material,
            NEW.price_labor,
            NEW.price_equipment,
            NEW.price_subcon,
            'CREATE_OVERRIDE',
            auth.uid()
        );
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.final_price IS DISTINCT FROM NEW.final_price) THEN
             INSERT INTO public.ahsp_price_history (
                ahsp_id,
                zone_id,
                old_price,
                new_price,
                price_material,
                price_labor,
                price_equipment,
                price_subcon,
                change_type,
                changed_by
            ) VALUES (
                NEW.ahsp_id,
                NEW.zone_id,
                OLD.final_price,
                NEW.final_price,
                NEW.price_material,
                NEW.price_labor,
                NEW.price_equipment,
                NEW.price_subcon,
                'UPDATE_OVERRIDE',
                auth.uid()
            );
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_zone_price_change ON public.ahsp_zone_prices;
CREATE TRIGGER trg_zone_price_change
AFTER INSERT OR UPDATE ON public.ahsp_zone_prices
FOR EACH ROW EXECUTE FUNCTION log_zone_price_change();
