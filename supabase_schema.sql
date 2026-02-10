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
alter table public.rab_items enable row level security;

-- Create policies to allow public access (for development)
-- WARNING: In production, restrict this to authenticated users
create policy "Allow public select resources" on public.resources for select using (true);
create policy "Allow public insert resources" on public.resources for insert with check (true);
create policy "Allow public update resources" on public.resources for update using (true);
create policy "Allow public delete resources" on public.resources for delete using (true);

create policy "Allow public select ahsp_items" on public.ahsp_items for select using (true);
create policy "Allow public insert ahsp_items" on public.ahsp_items for insert with check (true);
create policy "Allow public update ahsp_items" on public.ahsp_items for update using (true);
create policy "Allow public delete ahsp_items" on public.ahsp_items for delete using (true);

create policy "Allow public select ahsp_components" on public.ahsp_components for select using (true);
create policy "Allow public insert ahsp_components" on public.ahsp_components for insert with check (true);
create policy "Allow public update ahsp_components" on public.ahsp_components for update using (true);
create policy "Allow public delete ahsp_components" on public.ahsp_components for delete using (true);

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

-- Enable RLS for new tables
alter table public.projects enable row level security;
alter table public.wbs_items enable row level security;
alter table public.timeline_tasks enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.rap_data enable row level security;

-- Public policies for new tables (Dev only)
create policy "Allow public all projects" on public.projects for all using (true);
create policy "Allow public all wbs_items" on public.wbs_items for all using (true);
create policy "Allow public all timeline_tasks" on public.timeline_tasks for all using (true);
create policy "Allow public all task_dependencies" on public.task_dependencies for all using (true);
create policy "Allow public all rap_data" on public.rap_data for all using (true);

-- ============================================================
-- MIGRATION NOTES
-- After running this schema, apply migrations in order:
--   1. supabase/migrations/001_fix_foreign_keys.sql
--   2. supabase/migrations/002_add_indexes.sql
--   3. supabase/migrations/003_add_updated_at_triggers.sql
--   4. supabase/migrations/004_add_auth_support.sql
-- ============================================================
