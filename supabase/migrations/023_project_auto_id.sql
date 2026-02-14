-- 023_project_auto_id.sql
-- Purpose: Implement robust auto-generation for project codes and IDs.
-- Pattern: PRJ-YYYY-XXXX (e.g., PRJ-2026-0001)

-- 1. Create or Reset Sequence
CREATE SEQUENCE IF NOT EXISTS public.project_code_seq START 1;

-- 2. Create modern generation function
CREATE OR REPLACE FUNCTION public.generate_project_code()
RETURNS TRIGGER AS $$
DECLARE
    year_prefix TEXT;
    next_val TEXT;
BEGIN
    -- Extract current year
    year_prefix := to_char(CURRENT_DATE, 'YYYY');
    
    -- Handle CODE (The display number)
    IF NEW.code IS NULL OR NEW.code = '' THEN
        next_val := LPAD(nextval('public.project_code_seq')::text, 4, '0');
        NEW.code := 'PRJ-' || year_prefix || '-' || next_val;
    END IF;
    
    -- Handle ID (The Primary Key)
    -- If ID is not provided, use the generated code as the ID
    IF NEW.id IS NULL OR NEW.id = '' THEN
        -- If code was just generated, use it
        NEW.id := NEW.code;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Apply Trigger
DROP TRIGGER IF EXISTS trg_auto_project_code ON public.projects;
CREATE TRIGGER trg_auto_project_code
BEFORE INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.generate_project_code();

-- 4. Set default for ID column to ensure it's not null but basically handled by trigger
-- Setting a dummy default can sometimes help with some ORMs/libraries
-- But we'll rely on the BEFORE INSERT trigger.

DO $$ 
BEGIN 
    RAISE NOTICE 'Project auto-generation logic (PRJ-YYYY-XXXX) applied.';
END $$;
