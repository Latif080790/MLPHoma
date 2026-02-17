-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- 1. Resources Table
create table if not exists public.resources (
  id text primary key,
  code text,
  name text not null,
  type text check (type in ('material', 'labor', 'equipment', 'subcontractor')),
  unit text,
  unit_price numeric default 0,
  supplier text,
  specifications text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. AHSP Items Table
create table if not exists public.ahsp_items (
  id text primary key,
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

-- 3. AHSP Components Table
create table if not exists public.ahsp_components (
  id text primary key,
  ahsp_id text references public.ahsp_items(id) on delete cascade,
  resource_id text references public.resources(id),
  type text,
  coefficient numeric default 0,
  unit text,
  unit_price numeric default 0,
  subtotal numeric default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3B. AHSP Price History Table
create table if not exists public.ahsp_price_history (
  id uuid default uuid_generate_v4() primary key,
  ahsp_id text references public.ahsp_items(id) on delete cascade,
  zone_id uuid,
  old_price numeric,
  new_price numeric,
  price_material numeric default 0,
  price_labor numeric default 0,
  price_equipment numeric default 0,
  price_subcon numeric default 0,
  change_type text,
  change_reason text,
  changed_by uuid,
  created_at timestamptz default now()
);

-- 4. RAB Items Table (Existing or New)
create table if not exists public.rab_items (
  id text primary key,
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

-- Enable Row Level Security (Optional - adjust policies as needed)
alter table public.resources enable row level security;
alter table public.ahsp_items enable row level security;
alter table public.ahsp_components enable row level security;
alter table public.ahsp_price_history enable row level security;
alter table public.rab_items enable row level security;

-- Create policies to allow public access (for development)
-- WARNING: In production, restrict this to authenticated users
drop policy if exists "Allow public select resources" on public.resources;
create policy "Allow public select resources" on public.resources for select using (true);

drop policy if exists "Allow public insert resources" on public.resources;
create policy "Allow public insert resources" on public.resources for insert with check (true);

drop policy if exists "Allow public update resources" on public.resources;
create policy "Allow public update resources" on public.resources for update using (true);

drop policy if exists "Allow public delete resources" on public.resources;
create policy "Allow public delete resources" on public.resources for delete using (true);

drop policy if exists "Allow public select ahsp_items" on public.ahsp_items;
create policy "Allow public select ahsp_items" on public.ahsp_items for select using (true);

drop policy if exists "Allow public insert ahsp_items" on public.ahsp_items;
create policy "Allow public insert ahsp_items" on public.ahsp_items for insert with check (true);

drop policy if exists "Allow public update ahsp_items" on public.ahsp_items;
create policy "Allow public update ahsp_items" on public.ahsp_items for update using (true);

drop policy if exists "Allow public delete ahsp_items" on public.ahsp_items;
create policy "Allow public delete ahsp_items" on public.ahsp_items for delete using (true);

drop policy if exists "Allow public select ahsp_components" on public.ahsp_components;
create policy "Allow public select ahsp_components" on public.ahsp_components for select using (true);

drop policy if exists "Allow public insert ahsp_components" on public.ahsp_components;
create policy "Allow public insert ahsp_components" on public.ahsp_components for insert with check (true);

drop policy if exists "Allow public update ahsp_components" on public.ahsp_components;
create policy "Allow public update ahsp_components" on public.ahsp_components for update using (true);

drop policy if exists "Allow public delete ahsp_components" on public.ahsp_components;
create policy "Allow public delete ahsp_components" on public.ahsp_components for delete using (true);

drop policy if exists "Allow public select ahsp_price_history" on public.ahsp_price_history;
create policy "Allow public select ahsp_price_history" on public.ahsp_price_history for select using (true);

drop policy if exists "Allow public insert ahsp_price_history" on public.ahsp_price_history;
create policy "Allow public insert ahsp_price_history" on public.ahsp_price_history for insert with check (true);

drop policy if exists "Allow public update ahsp_price_history" on public.ahsp_price_history;
create policy "Allow public update ahsp_price_history" on public.ahsp_price_history for update using (true);

drop policy if exists "Allow public delete ahsp_price_history" on public.ahsp_price_history;
create policy "Allow public delete ahsp_price_history" on public.ahsp_price_history for delete using (true);

-- 5. Projects Table
create table if not exists public.projects (
  id text primary key,
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

-- 6. WBS Items Table
create table if not exists public.wbs_items (
  id text primary key,
  project_id text references public.projects(id) on delete cascade,
  code text,
  name text not null,
  level integer default 1,
  parent_id text references public.wbs_items(id) on delete cascade,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 7. Timeline Tasks Table
create table if not exists public.timeline_tasks (
  id text primary key,
  project_id text references public.projects(id) on delete cascade,
  name text not null,
  description text,
  start_date date,
  end_date date,
  duration integer default 1,
  progress numeric default 0,
  status text default 'not_started',
  priority text default 'medium',
  wbs_id text references public.wbs_items(id) on delete set null,
  rab_id text references public.rab_items(id) on delete set null,
  baseline_start_date date,
  baseline_end_date date,
  assigned_resources jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 8. Task Dependencies Table
create table if not exists public.task_dependencies (
  id text primary key,
  project_id text references public.projects(id) on delete cascade,
  predecessor_id text references public.timeline_tasks(id) on delete cascade,
  successor_id text references public.timeline_tasks(id) on delete cascade,
  type text default 'FS',
  lag integer default 0,
  created_at timestamptz default now()
);

-- 9. RAP Data Table (Financial Plan)
create table if not exists public.rap_data (
  project_id text primary key references public.projects(id) on delete cascade,
  plan_data jsonb default '[]'::jsonb, -- Stores the RapPoint[] array
  updated_at timestamptz default now()
);

-- 10. RAB Versions Table (Version Control)
create table if not exists public.rab_versions (
  id text primary key,
  project_id text references public.projects(id) on delete cascade,
  version integer not null,
  created_at timestamptz default now(),
  created_by text,
  created_by_name text,
  description text,
  change_type text check (change_type in ('create', 'update', 'delete', 'bulk_update', 'import', 'restore')),
  changes jsonb, -- Array of change logs
  snapshot jsonb, -- Full state snapshot
  status text default 'draft' check (status in ('draft', 'published')),
  tags text[],
  unique(project_id, version)
);

-- 11. RAB Approvals Table (Approval Workflow)
create table if not exists public.rab_approvals (
  id text primary key,
  project_id text references public.projects(id) on delete cascade,
  rab_version_id text references public.rab_versions(id),
  status text default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  submitted_at timestamptz default now(),
  submitted_by text,
  submitted_by_name text,
  current_step integer default 1,
  rejection_reason text,
  approval_chain jsonb, -- Array of approval steps
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 12. AHSP Creation Modes Table (Track how AHSP was created)
create table if not exists public.ahsp_creation_logs (
  id text primary key,
  ahsp_id text references public.ahsp_items(id) on delete cascade,
  creation_mode text check (creation_mode in ('sni', 'custom', 'historical')),
  source_reference text, -- SNI code or historical project ID
  created_at timestamptz default now(),
  created_by text,
  metadata jsonb -- Additional tracking data
);

-- Enable RLS for new tables
alter table public.projects enable row level security;
alter table public.wbs_items enable row level security;
alter table public.timeline_tasks enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.rap_data enable row level security;
alter table public.rab_versions enable row level security;
alter table public.rab_approvals enable row level security;
alter table public.ahsp_creation_logs enable row level security;

-- Public policies for new tables (Dev only)
drop policy if exists "Allow public all projects" on public.projects;
create policy "Allow public all projects" on public.projects for all using (true);

drop policy if exists "Allow public all wbs_items" on public.wbs_items;
create policy "Allow public all wbs_items" on public.wbs_items for all using (true);

drop policy if exists "Allow public all timeline_tasks" on public.timeline_tasks;
create policy "Allow public all timeline_tasks" on public.timeline_tasks for all using (true);

drop policy if exists "Allow public all task_dependencies" on public.task_dependencies;
create policy "Allow public all task_dependencies" on public.task_dependencies for all using (true);

drop policy if exists "Allow public all rap_data" on public.rap_data;
create policy "Allow public all rap_data" on public.rap_data for all using (true);

drop policy if exists "Allow public all rab_versions" on public.rab_versions;
create policy "Allow public all rab_versions" on public.rab_versions for all using (true);

drop policy if exists "Allow public all rab_approvals" on public.rab_approvals;
create policy "Allow public all rab_approvals" on public.rab_approvals for all using (true);

drop policy if exists "Allow public all ahsp_creation_logs" on public.ahsp_creation_logs;
create policy "Allow public all ahsp_creation_logs" on public.ahsp_creation_logs for all using (true);

-- ============================================================
-- MIGRATION NOTES
-- After running this schema, apply migrations in order:
--   1. supabase/migrations/001_fix_foreign_keys.sql
--   2. supabase/migrations/002_add_indexes.sql
--   3. supabase/migrations/003_add_updated_at_triggers.sql
--   4. supabase/migrations/004_add_auth_support.sql
-- ============================================================
