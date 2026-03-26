-- Migration: 058_project_geofence_coords.sql
-- Description: Add geospatial coordinates to projects for field validation.

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Initial default (Monas, Jakarta) for existing projects to avoid null errors during testing
UPDATE public.projects 
SET latitude = -6.1753924, longitude = 106.8271528 
WHERE latitude IS NULL;
