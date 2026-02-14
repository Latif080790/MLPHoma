-- 016_archive_system.sql
-- Purpose: Support Project Handover and Archival
-- Features: Status Enum, Archived Timestamp, and Soft Delete capability

-- 1. Create Project Status Enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
        CREATE TYPE public.project_status AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED', 'suspended');
    ELSE
        -- Add value if missing
        ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'ARCHIVED';
        ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'COMPLETED';
    END IF;
END $$;

-- 2. Add Status column to Projects table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'status') THEN
        ALTER TABLE public.projects ADD COLUMN status public.project_status DEFAULT 'ACTIVE';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'archived_at') THEN
        ALTER TABLE public.projects ADD COLUMN archived_at TIMESTAMPTZ NULL;
    END IF;
END $$;

-- 3. Update RLS to allow viewing archived projects but maybe restrict edits (Optional, keeping simple for now)
-- We just ensure the column is accessible
GRANT ALL ON TABLE public.projects TO authenticated;
