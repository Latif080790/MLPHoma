-- ============================================================
-- Migration: 003_add_updated_at_triggers.sql
-- Purpose: Auto-update updated_at timestamps on UPDATE operations
-- Idempotent: Uses DROP TRIGGER IF EXISTS before CREATE
-- ============================================================

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to resources table
DROP TRIGGER IF EXISTS update_resources_updated_at ON public.resources;
CREATE TRIGGER update_resources_updated_at
  BEFORE UPDATE ON public.resources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to ahsp_items table
DROP TRIGGER IF EXISTS update_ahsp_items_updated_at ON public.ahsp_items;
CREATE TRIGGER update_ahsp_items_updated_at
  BEFORE UPDATE ON public.ahsp_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to ahsp_components table
DROP TRIGGER IF EXISTS update_ahsp_components_updated_at ON public.ahsp_components;
CREATE TRIGGER update_ahsp_components_updated_at
  BEFORE UPDATE ON public.ahsp_components
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to rab_items table
DROP TRIGGER IF EXISTS update_rab_items_updated_at ON public.rab_items;
CREATE TRIGGER update_rab_items_updated_at
  BEFORE UPDATE ON public.rab_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to projects table
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to wbs_items table
DROP TRIGGER IF EXISTS update_wbs_items_updated_at ON public.wbs_items;
CREATE TRIGGER update_wbs_items_updated_at
  BEFORE UPDATE ON public.wbs_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to timeline_tasks table
DROP TRIGGER IF EXISTS update_timeline_tasks_updated_at ON public.timeline_tasks;
CREATE TRIGGER update_timeline_tasks_updated_at
  BEFORE UPDATE ON public.timeline_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to rap_data table
DROP TRIGGER IF EXISTS update_rap_data_updated_at ON public.rap_data;
CREATE TRIGGER update_rap_data_updated_at
  BEFORE UPDATE ON public.rap_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
