-- ============================================================
-- Migration: 002_add_indexes.sql
-- Purpose: Add performance indexes for common query patterns
-- Idempotent: Uses CREATE INDEX IF NOT EXISTS
-- ============================================================

-- Resources table indexes
CREATE INDEX IF NOT EXISTS idx_resources_type ON public.resources(type);
CREATE INDEX IF NOT EXISTS idx_resources_code ON public.resources(code);
CREATE INDEX IF NOT EXISTS idx_resources_is_active ON public.resources(is_active);

-- AHSP items table indexes
CREATE INDEX IF NOT EXISTS idx_ahsp_items_category ON public.ahsp_items(category);
CREATE INDEX IF NOT EXISTS idx_ahsp_items_is_active ON public.ahsp_items(is_active);

-- AHSP components table indexes
CREATE INDEX IF NOT EXISTS idx_ahsp_components_ahsp_id ON public.ahsp_components(ahsp_id);
CREATE INDEX IF NOT EXISTS idx_ahsp_components_resource_id ON public.ahsp_components(resource_id);

-- RAB items table indexes
CREATE INDEX IF NOT EXISTS idx_rab_items_project_id ON public.rab_items(project_id);
CREATE INDEX IF NOT EXISTS idx_rab_items_task_id ON public.rab_items(task_id);
CREATE INDEX IF NOT EXISTS idx_rab_items_ahsp_code ON public.rab_items(ahsp_code);

-- Projects table indexes
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_code ON public.projects(code);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);

-- WBS items table indexes
CREATE INDEX IF NOT EXISTS idx_wbs_items_project_id ON public.wbs_items(project_id);
CREATE INDEX IF NOT EXISTS idx_wbs_items_parent_id ON public.wbs_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_wbs_items_project_level ON public.wbs_items(project_id, level);

-- Timeline tasks table indexes
CREATE INDEX IF NOT EXISTS idx_timeline_tasks_project_id ON public.timeline_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_timeline_tasks_wbs_id ON public.timeline_tasks(wbs_id);
CREATE INDEX IF NOT EXISTS idx_timeline_tasks_rab_id ON public.timeline_tasks(rab_id);
CREATE INDEX IF NOT EXISTS idx_timeline_tasks_status ON public.timeline_tasks(status);
CREATE INDEX IF NOT EXISTS idx_timeline_tasks_project_status ON public.timeline_tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_timeline_tasks_date_range ON public.timeline_tasks(start_date, end_date);

-- Task dependencies table indexes
CREATE INDEX IF NOT EXISTS idx_task_dependencies_project_id ON public.task_dependencies(project_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_predecessor_id ON public.task_dependencies(predecessor_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_successor_id ON public.task_dependencies(successor_id);

-- RAP data table indexes
CREATE INDEX IF NOT EXISTS idx_rap_data_updated_at ON public.rap_data(updated_at);
