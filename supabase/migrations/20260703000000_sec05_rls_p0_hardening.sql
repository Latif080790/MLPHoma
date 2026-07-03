-- SEC-05 · P0 RLS hardening (verified live 2026-07-03)
-- Closes privilege-escalation & cross-tenant tamper on the 4 highest-risk tables.
-- Strategy: RLS policies are OR-combined (permissive). Each table below already
-- has CORRECT scoped policies, but redundant `USING (true)` policies override them.
-- We drop only the always-true policies and add owner/role guards where needed.
-- Scope intentionally limited to P0 tables; the remaining ~30 always-true tables
-- are deferred to a reviewed Sprint C migration.

begin;

-- ========================= profiles =========================
-- Was: any authenticated user could UPDATE/DELETE ANY profile (incl. set role='admin')
-- and anon could read all profiles (PII). Keep only self-scoped + authenticated-read.
drop policy if exists "allow_delete_profiles"            on public.profiles;
drop policy if exists "allow_insert_profiles"            on public.profiles;
drop policy if exists "allow_select_profiles"            on public.profiles;
drop policy if exists "allow_update_profiles"            on public.profiles;
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
-- Retained: "Users can view own profile", "Allow authenticated read profiles",
--           "Users can insert own profile", "Users can update own profile"

-- Anonymous (unauthenticated) clients must never read user PII.
revoke select on public.profiles from anon;

-- Even on their OWN row, non-admins must not be able to elevate their role.
create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    if not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    ) then
      raise exception 'Only admins can change profile roles';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_profile_role_escalation on public.profiles;
create trigger trg_prevent_profile_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_role_escalation();

-- ===================== project_members ======================
-- Was: any authenticated user could add themselves to ANY project (lateral movement
-- into other tenants' data). Keep admin/scoped policies; add project-owner management.
drop policy if exists "allow_delete_project_members"          on public.project_members;
drop policy if exists "allow_insert_project_members"          on public.project_members;
drop policy if exists "allow_update_project_members"          on public.project_members;
drop policy if exists "allow_select_project_members"          on public.project_members;
drop policy if exists "Authenticated project_members access"  on public.project_members;
-- Retained: "Admins manage memberships", "Membership viewable by project members"

drop policy if exists "Project owner manages members" on public.project_members;
create policy "Project owner manages members" on public.project_members
  for all
  to authenticated
  using (
    exists (
      select 1 from public.projects pr
      where pr.id = project_members.project_id and pr.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects pr
      where pr.id = project_members.project_id and pr.user_id = auth.uid()
    )
  );

-- ======================== audit_logs ========================
-- Was: any authenticated user could DELETE/UPDATE the audit trail. Immutable now:
-- retained no_delete/no_update (USING false) + authenticated select/insert.
drop policy if exists "allow_delete_audit_logs" on public.audit_logs;
drop policy if exists "allow_update_audit_logs" on public.audit_logs;
drop policy if exists "allow_select_audit_logs" on public.audit_logs;
drop policy if exists "allow_insert_audit_logs" on public.audit_logs;
-- Retained: audit_logs_no_delete, audit_logs_no_update,
--           audit_logs_select_all, audit_logs_insert_only

-- ==================== approval_requests =====================
-- Was: any authenticated user could UPDATE (approve) or DELETE approvals = workflow
-- bypass. Restrict mutations to project leads; keep authenticated insert/view.
drop policy if exists "allow_delete_approval_requests"      on public.approval_requests;
drop policy if exists "allow_select_approval_requests"      on public.approval_requests;
drop policy if exists "allow_update_approval_requests"      on public.approval_requests;
drop policy if exists "allow_insert_approval_requests"      on public.approval_requests;
drop policy if exists "Managers/admins can update approvals" on public.approval_requests;
-- Retained: "Project data manageable by leads" (ALL, has_project_role admin/manager),
--           "Authenticated users can insert approvals",
--           "Authenticated users can view approvals",
--           "Project data visible to members"

commit;
