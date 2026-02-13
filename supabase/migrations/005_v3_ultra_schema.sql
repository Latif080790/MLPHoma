-- Migration: 005_v3_ultra_schema.sql
-- Description: Implements the "Lean 8" architecture for MLPHoma v3.0 Ultra
-- Includes: Costing Consolidation, Supply Chain, Change Management, Risk, and Settings.
-- Now includes base table definitions to ensure idempotent execution.

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 0. BASE TABLES (Ensure Dependency Structure Exists)
-- ==========================================

-- Ensure Projects Table Exists
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, -- Changed to UUID for consistency
  code text,
  name text not null,
  client_name text,
  location text,
  start_date date,
  end_date date,
  budget numeric default 0,
  status text default 'draft',
  payment_terms jsonb default '{}'::jsonb,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ensure AHSP Items Table Exists
CREATE TABLE IF NOT EXISTS public.ahsp_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  code text unique,
  name text not null,
  description text,
  unit text,
  category text,
  base_price numeric default 0,
  final_price numeric default 0,
  overhead_percentage numeric default 0,
  profit_percentage numeric default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ensure WBS Items Table Exists
CREATE TABLE IF NOT EXISTS public.wbs_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id text, -- Keep as text to reference if existing project ID is string-based, ideally change to UUID if fresh
  code text,
  name text not null,
  level integer default 1,
  parent_id uuid REFERENCES public.wbs_items(id) ON DELETE CASCADE, -- Self referential
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- Note on WBS project_id: If projects use UUID, this should reference projects(id). 
-- However, existing schema likely uses text. We'll proceed with looseness for now or assume users fix it.

-- Ensure RAB Items Table Exists (The one causing error 42P01)
CREATE TABLE IF NOT EXISTS public.rab_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id text, -- Link to projects table if exists
  ahsp_code text,
  name text,
  unit text,
  volume numeric default 0,
  unit_price numeric default 0,
  final_total numeric default 0,
  task_id text, -- Link to timeline tasks
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


-- ==========================================
-- 1. COSTING MODULE (RAB + RAP Consolidated)
-- ==========================================

-- Upgrade RAB Items with Split Costs
ALTER TABLE public.rab_items
ADD COLUMN IF NOT EXISTS cost_material numeric default 0,
ADD COLUMN IF NOT EXISTS cost_labor numeric default 0,
ADD COLUMN IF NOT EXISTS cost_equipment numeric default 0,
ADD COLUMN IF NOT EXISTS cost_subcon numeric default 0,
ADD COLUMN IF NOT EXISTS markup_percentage numeric default 0,
ADD COLUMN IF NOT EXISTS weight_percentage numeric default 0;

-- Create RAP Items Table (Replacing JSONB approach)
CREATE TABLE IF NOT EXISTS public.rap_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id text,
  wbs_id uuid REFERENCES public.wbs_items(id), -- Changed to UUID if creating fresh
  ahsp_id uuid REFERENCES public.ahsp_items(id),
  rab_item_id uuid REFERENCES public.rab_items(id),
  
  -- Budget Baseline
  qty_budget numeric default 0,
  unit_price_budget numeric default 0,
  total_budget numeric GENERATED ALWAYS AS (qty_budget * unit_price_budget) STORED,
  
  -- Real-time Tracking
  committed_cost numeric default 0, -- PO Submitted/Approved
  actual_cost numeric default 0,    -- Paid Invoices
  remaining_budget numeric GENERATED ALWAYS AS ((qty_budget * unit_price_budget) - (committed_cost + actual_cost)) STORED,
  
  -- Risk & Control
  risk_buffer_amount numeric default 0,
  notes text,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ==========================================
-- 2. SUPPLY CHAIN MODULE (Logistics)
-- ==========================================

-- Material Requests (Site -> Logistics)
CREATE TABLE IF NOT EXISTS public.material_requests (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id text,
  wbs_id uuid REFERENCES public.wbs_items(id),
  
  item_name text not null,
  unit text,
  quantity_requested numeric default 0,
  
  date_required date,
  status text default 'PENDING', -- PENDING, APPROVED, REJECTED, PO_CREATED
  
  requested_by uuid, -- References auth.users(id) but kept loose for now to avoid FK issues if auth not fully set
  notes text,
  created_at timestamptz default now()
);

-- Purchase Orders Header
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id text,
  po_number text unique not null,
  vendor_name text,
  
  status text default 'DRAFT', -- DRAFT, PENDING, APPROVED, REJECTED, COMPLETED
  total_amount numeric default 0,
  
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz default now()
);

-- Purchase Order Items (Linked to RAP for Budget Locking)
CREATE TABLE IF NOT EXISTS public.po_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  po_id uuid REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  rap_item_id uuid REFERENCES public.rap_items(id), -- Critical for Budget Check
  
  item_name text,
  quantity numeric default 0,
  unit_price numeric default 0,
  total_price numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
  
  created_at timestamptz default now()
);

-- Inventory Transactions (Log In/Out)
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id text,
  wbs_id uuid REFERENCES public.wbs_items(id),
  
  material_name text not null,
  transaction_type text check (transaction_type in ('IN', 'OUT', 'TRANSFER', 'RETURN')),
  quantity numeric default 0,
  unit text,
  
  reference_doc text, -- PO Number or Transfer ID
  created_at timestamptz default now()
);

-- ==========================================
-- 3. CHANGE MANAGEMENT (CCO / VO)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.change_orders (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id text,
  vo_number text unique,
  
  title text,
  description text,
  status text default 'DRAFT',
  
  cost_impact numeric default 0,
  schedule_impact_days integer default 0,
  
  created_by uuid,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.change_order_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  change_order_id uuid REFERENCES public.change_orders(id) ON DELETE CASCADE,
  
  item_description text,
  volume_delta numeric default 0,
  unit_price numeric default 0,
  total_delta numeric default 0,
  
  target_wbs_id uuid REFERENCES public.wbs_items(id)
);

-- ==========================================
-- 4. RISK, DOCUMENTS & SETTINGS
-- ==========================================

-- Timeline Tasks definition just in case
CREATE TABLE IF NOT EXISTS public.timeline_tasks (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id text,
  name text not null,
  description text,
  start_date date,
  end_date date,
  duration integer default 1,
  progress numeric default 0,
  status text default 'not_started',
  created_at timestamptz default now()
);


-- Risk & Schedule Enhancements
ALTER TABLE public.timeline_tasks
ADD COLUMN IF NOT EXISTS risk_level text default 'LOW',
ADD COLUMN IF NOT EXISTS risk_mitigation_plan text;

-- Intelligent Documents (Versioning)
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id text,
  category text,
  title text,
  file_url text,
  version_number integer default 1,
  
  is_active boolean default true,
  qr_code_hash text,
  
  created_at timestamptz default now()
);

-- Settings & Audit
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  config_key text unique,
  config_value jsonb,
  description text
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid,
  action text,
  entity text,
  details jsonb,
  created_at timestamptz default now()
);

-- Note: RLS Policies should be applied separately for production security.
