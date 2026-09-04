-- Jeffdesign101 v2.13 — Multi Website Projects
-- Run ONCE after v2.12. Safe to rerun. Does not delete existing data.

create extension if not exists pgcrypto;

-- Compatibility with v2.12. These columns are kept only so an existing single-project
-- intake can be migrated automatically; new projects use website_projects.
alter table public.client_submissions
  add column if not exists website_name text not null default '',
  add column if not exists website_intake jsonb not null default '{}'::jsonb,
  add column if not exists website_notes text not null default '';

create table if not exists public.website_projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  website_name text not null default '',
  website_intake jsonb not null default '{}'::jsonb,
  website_notes text not null default '',
  status text not null default 'draft' check (status in ('draft','in_progress','ready','complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists website_projects_client_updated_idx
  on public.website_projects(client_id, updated_at desc);

alter table public.website_projects enable row level security;

drop policy if exists "website_projects_read" on public.website_projects;
drop policy if exists "website_projects_insert" on public.website_projects;
drop policy if exists "website_projects_update" on public.website_projects;
drop policy if exists "website_projects_delete" on public.website_projects;

create policy "website_projects_read" on public.website_projects
for select to authenticated
using (public.is_admin() or public.can_access_client(client_id));

create policy "website_projects_insert" on public.website_projects
for insert to authenticated
with check (
  public.is_admin()
  or (
    created_by = auth.uid()
    and exists (
      select 1 from public.clients c
      where c.id = client_id
        and c.auth_user_id = auth.uid()
        and c.portal_permission = 'edit'
        and c.deleted_at is null
    )
  )
);

create policy "website_projects_update" on public.website_projects
for update to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.clients c
    where c.id = website_projects.client_id
      and c.auth_user_id = auth.uid()
      and c.portal_permission = 'edit'
      and c.deleted_at is null
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.clients c
    where c.id = website_projects.client_id
      and c.auth_user_id = auth.uid()
      and c.portal_permission = 'edit'
      and c.deleted_at is null
  )
);

create policy "website_projects_delete" on public.website_projects
for delete to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.clients c
    where c.id = website_projects.client_id
      and c.auth_user_id = auth.uid()
      and c.portal_permission = 'edit'
      and c.deleted_at is null
  )
);

grant select,insert,update,delete on public.website_projects to authenticated;

-- Migrate one existing v2.12 intake per employer into the new multi-project table.
-- This is rerun-safe because it only migrates when that employer has no website project yet.
insert into public.website_projects (
  client_id, created_by, website_name, website_intake, website_notes, status, created_at, updated_at
)
select
  s.client_id,
  s.user_id,
  coalesce(nullif(s.website_name,''), 'Website Project'),
  coalesce(s.website_intake, '{}'::jsonb),
  coalesce(s.website_notes,''),
  'in_progress',
  now(),
  now()
from public.client_submissions s
where (
  coalesce(s.website_name,'') <> ''
  or coalesce(s.website_notes,'') <> ''
  or coalesce(s.website_intake, '{}'::jsonb) <> '{}'::jsonb
)
and not exists (
  select 1 from public.website_projects wp where wp.client_id = s.client_id
);
