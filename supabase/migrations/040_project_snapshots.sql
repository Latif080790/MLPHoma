-- Migration: 040_project_snapshots.sql
-- Description: Creates snapshot tables for RAB and RAP, and adds a stored procedure to freeze baselines when a project moves to execution.

-- ==========================================
-- 1. SNAPSHOT TABLES
-- ==========================================

-- A. RAB Snapshots
CREATE TABLE IF NOT EXISTS public.rab_snapshots (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    snapshot_name text NOT NULL, -- e.g. "Baseline V1"
    project_id text NOT NULL,
    created_at timestamptz DEFAULT now(),
    created_by uuid,
    -- Store the entire rab_items structure as JSONB to prevent schema drift issues
    snapshot_data jsonb NOT NULL 
);

-- B. RAP Snapshots
CREATE TABLE IF NOT EXISTS public.rap_snapshots (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    snapshot_name text NOT NULL, 
    project_id text NOT NULL,
    created_at timestamptz DEFAULT now(),
    created_by uuid,
    snapshot_data jsonb NOT NULL 
);

-- ==========================================
-- 2. FREEZE BASELINE STORED PROCEDURE
-- ==========================================
-- This procedure deep copies the current active state of RAB and RAP into the snapshot tables.

CREATE OR REPLACE FUNCTION freeze_project_baseline(p_project_id text, p_snapshot_name text)
RETURNS void AS $$
DECLARE
    v_rab_data jsonb;
    v_rap_data jsonb;
BEGIN
    -- 1. Gather all RAB items for the project into a JSON array
    SELECT jsonb_agg(row_to_json(r))
    INTO v_rab_data
    FROM public.rab_items r
    WHERE r.project_id = p_project_id;

    -- 2. Gather all RAP items for the project into a JSON array
    SELECT jsonb_agg(row_to_json(p))
    INTO v_rap_data
    FROM public.rap_items p
    WHERE p.project_id = p_project_id;

    -- 3. Insert RAB Snapshot if data exists
    IF v_rab_data IS NOT NULL THEN
        INSERT INTO public.rab_snapshots (snapshot_name, project_id, created_by, snapshot_data)
        VALUES (
            p_snapshot_name,
            p_project_id,
            coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
            v_rab_data
        );
    END IF;

    -- 4. Insert RAP Snapshot if data exists
    IF v_rap_data IS NOT NULL THEN
        INSERT INTO public.rap_snapshots (snapshot_name, project_id, created_by, snapshot_data)
        VALUES (
            p_snapshot_name,
            p_project_id,
            coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
            v_rap_data
        );
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
