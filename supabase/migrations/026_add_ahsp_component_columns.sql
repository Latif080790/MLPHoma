-- 026_add_ahsp_component_columns.sql
-- Purpose: Add 'unit' and 'unit_price' to ahsp_components table.
-- These columns are used to snapshot resource data at the time of component creation, 
-- ensuring historical accuracy even if master resource prices change later.

DO $$
BEGIN
    -- Add 'unit' column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'ahsp_components' 
        AND column_name = 'unit'
    ) THEN
        ALTER TABLE public.ahsp_components ADD COLUMN unit TEXT;
    END IF;

    -- Add 'unit_price' column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'ahsp_components' 
        AND column_name = 'unit_price'
    ) THEN
        ALTER TABLE public.ahsp_components ADD COLUMN unit_price NUMERIC DEFAULT 0;
    END IF;

    -- Optional: Backfill data from associated resources if columns were empty
    -- This assumes unit and unit_price are currently null/0 and fetching from master is desired for recovery
    UPDATE public.ahsp_components ac
    SET 
        unit = r.unit,
        unit_price = r.unit_price
    FROM public.resources r
    WHERE ac.resource_id = r.id
    AND (ac.unit IS NULL OR ac.unit_price = 0);

END $$;
