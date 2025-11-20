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
