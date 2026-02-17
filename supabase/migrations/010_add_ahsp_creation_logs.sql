-- Migration: Add AHSP Creation Logs Table
-- Date: 2026-02-17
-- Description: Track how AHSP items were created (SNI, Custom, Historical)

-- Create ahsp_creation_logs table
create table if not exists public.ahsp_creation_logs (
  id text primary key default gen_random_uuid()::text,
  ahsp_id text references public.ahsp_items(id) on delete cascade,
  creation_mode text check (creation_mode in ('sni', 'custom', 'historical')),
  source_reference text, -- SNI code or historical project ID
  created_at timestamptz default now(),
  created_by text,
  metadata jsonb -- Additional tracking data
);

-- Enable RLS
alter table public.ahsp_creation_logs enable row level security;

-- Public policy for development (update this for production)
drop policy if exists "Allow public all ahsp_creation_logs" on public.ahsp_creation_logs;
create policy "Allow public all ahsp_creation_logs" on public.ahsp_creation_logs for all using (true);

-- Create index for faster queries
create index if not exists idx_ahsp_creation_logs_ahsp_id on public.ahsp_creation_logs(ahsp_id);
create index if not exists idx_ahsp_creation_logs_mode on public.ahsp_creation_logs(creation_mode);
