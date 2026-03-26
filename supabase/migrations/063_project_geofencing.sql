-- ============================================================
-- 063_project_geofencing.sql
-- Adds coordinate fields to projects for field accuracy validation.
-- ============================================================

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS latitude NUMERIC,
ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- Comment for metadata
COMMENT ON COLUMN public.projects.latitude IS 'Geofence center point latitude';
COMMENT ON COLUMN public.projects.longitude IS 'Geofence center point longitude';
