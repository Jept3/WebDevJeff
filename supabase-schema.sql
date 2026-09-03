-- ============================================================
-- LimeCRM — Supabase schema, Auth roles, RLS, and Storage
-- Run this entire file once in Supabase Dashboard → SQL Editor.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Profiles / roles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'client' check (role in ('admin','client')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'client')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute procedure public.handle_new_user();

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (email) on table public.profiles to authenticated;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

-- ---------- Clients ----------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  email text not null,
  phone text,
  website text,
  project_type text,
  status text not null default 'ongoing'
    check (status in ('ongoing','review','waiting','complete','paused')),
  priority text default 'Normal',
  start_date date,
  deadline date,
  completed_date date,
  budget text,
  overview text,
  hosting text,
  stack text,
  registrar text,
  contact text,
  deliverables text,
  notes text,
  tags text[] not null default '{}',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_email_lower_idx on public.clients (lower(email));
create index if not exists clients_deleted_idx on public.clients (deleted_at);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
before update on public.clients
for each row execute procedure public.set_updated_at();

alter table public.clients enable row level security;
revoke all on table public.clients from anon, authenticated;
grant select on table public.clients to authenticated;
grant insert, update, delete on table public.clients to authenticated;

drop policy if exists "clients_admin_select_all_client_select_own" on public.clients;
create policy "clients_admin_select_all_client_select_own"
on public.clients for select
to authenticated
using (
  public.is_admin()
  or (
    deleted_at is null
    and lower(email) = lower(coalesce(auth.jwt()->>'email',''))
  )
);

drop policy if exists "clients_admin_insert" on public.clients;
create policy "clients_admin_insert"
on public.clients for insert
to authenticated
with check (public.is_admin());

drop policy if exists "clients_admin_update" on public.clients;
create policy "clients_admin_update"
on public.clients for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "clients_admin_delete" on public.clients;
create policy "clients_admin_delete"
on public.clients for delete
to authenticated
using (public.is_admin());

-- ---------- Client-supplied information ----------
create table if not exists public.client_submissions (
  client_id uuid primary key references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  info text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.client_submissions enable row level security;
revoke all on table public.client_submissions from anon, authenticated;
grant select, insert, update on table public.client_submissions to authenticated;

drop policy if exists "submissions_select" on public.client_submissions;
create policy "submissions_select"
on public.client_submissions for select
to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
);

drop policy if exists "submissions_insert_own_client" on public.client_submissions;
create policy "submissions_insert_own_client"
on public.client_submissions for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.clients c
    where c.id = client_id
      and c.deleted_at is null
      and lower(c.email) = lower(coalesce(auth.jwt()->>'email',''))
  )
);

drop policy if exists "submissions_update_own" on public.client_submissions;
create policy "submissions_update_own"
on public.client_submissions for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

-- Helper for private Storage access.
create or replace function public.can_access_client(target_client uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1 from public.clients c
      where c.id = target_client
        and c.deleted_at is null
        and lower(c.email) = lower(coalesce(auth.jwt()->>'email',''))
    );
$$;

revoke all on function public.can_access_client(uuid) from public;
grant execute on function public.can_access_client(uuid) to authenticated;

-- ---------- Private client file bucket ----------
insert into storage.buckets (id, name, public)
values ('client-files','client-files',false)
on conflict (id) do update set public = false;

drop policy if exists "client_files_select" on storage.objects;
create policy "client_files_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'client-files'
  and public.can_access_client(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "client_files_insert" on storage.objects;
create policy "client_files_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'client-files'
  and public.can_access_client(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "client_files_delete" on storage.objects;
create policy "client_files_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'client-files'
  and public.can_access_client(((storage.foldername(name))[1])::uuid)
);

-- ============================================================
-- AFTER YOU CREATE YOUR ADMIN USER:
-- Replace the email below with your own email and run this once.
--
-- update public.profiles
-- set role = 'admin'
-- where lower(email) = lower('YOUR_ADMIN_EMAIL@example.com');
--
-- Keep client users as role = 'client'.
-- ============================================================


-- ============================================================
-- LimeCRM Client Portal v2 upgrade
-- ============================================================

alter table public.clients
  add column if not exists client_username text,
  add column if not exists portal_permission text not null default 'edit'
    check (portal_permission in ('edit','view'));

create unique index if not exists clients_username_lower_unique
on public.clients (lower(client_username))
where client_username is not null and client_username <> '';

alter table public.client_submissions
  add column if not exists info_html text not null default '';

-- Task of the Day
create table if not exists public.client_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  task text not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.client_tasks enable row level security;
revoke all on table public.client_tasks from anon, authenticated;
grant select, insert, update, delete on table public.client_tasks to authenticated;

drop policy if exists "tasks_select_accessible_project" on public.client_tasks;
create policy "tasks_select_accessible_project"
on public.client_tasks for select
to authenticated
using (public.is_admin() or public.can_access_client(client_id));

drop policy if exists "tasks_insert_editable_project" on public.client_tasks;
create policy "tasks_insert_editable_project"
on public.client_tasks for insert
to authenticated
with check (
  public.is_admin()
  or (
    user_id = auth.uid()
    and exists (
      select 1 from public.clients c
      where c.id = client_id
        and c.deleted_at is null
        and c.portal_permission = 'edit'
        and lower(c.email) = lower(coalesce(auth.jwt()->>'email',''))
    )
  )
);

drop policy if exists "tasks_update_editable_project" on public.client_tasks;
create policy "tasks_update_editable_project"
on public.client_tasks for update
to authenticated
using (
  public.is_admin()
  or (
    user_id = auth.uid()
    and exists (
      select 1 from public.clients c
      where c.id = client_id
        and c.portal_permission = 'edit'
        and lower(c.email) = lower(coalesce(auth.jwt()->>'email',''))
    )
  )
)
with check (public.is_admin() or user_id = auth.uid());

drop policy if exists "tasks_delete_editable_project" on public.client_tasks;
create policy "tasks_delete_editable_project"
on public.client_tasks for delete
to authenticated
using (
  public.is_admin()
  or (
    user_id = auth.uid()
    and exists (
      select 1 from public.clients c
      where c.id = client_id
        and c.portal_permission = 'edit'
        and lower(c.email) = lower(coalesce(auth.jwt()->>'email',''))
    )
  )
);

-- Client submission edit permission.
drop policy if exists "submissions_insert_own_client" on public.client_submissions;
create policy "submissions_insert_own_client"
on public.client_submissions for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.clients c
    where c.id = client_id
      and c.deleted_at is null
      and c.portal_permission = 'edit'
      and lower(c.email) = lower(coalesce(auth.jwt()->>'email',''))
  )
);

drop policy if exists "submissions_update_own" on public.client_submissions;
create policy "submissions_update_own"
on public.client_submissions for update
to authenticated
using (
  public.is_admin()
  or (
    user_id = auth.uid()
    and exists (
      select 1 from public.clients c
      where c.id = client_id
        and c.portal_permission = 'edit'
        and lower(c.email) = lower(coalesce(auth.jwt()->>'email',''))
    )
  )
)
with check (public.is_admin() or user_id = auth.uid());

-- Private username -> login email resolution.
-- This is intentionally SECURITY DEFINER so unauthenticated login can resolve
-- a configured username without exposing the full clients table.
create or replace function public.resolve_login_email(login_name text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email
  from public.clients
  where deleted_at is null
    and client_username is not null
    and lower(client_username) = lower(login_name)
  limit 1;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;

-- Storage write access must also honor View Only.
drop policy if exists "client_files_insert" on storage.objects;
create policy "client_files_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'client-files'
  and (
    public.is_admin()
    or exists (
      select 1 from public.clients c
      where c.id = ((storage.foldername(name))[1])::uuid
        and c.deleted_at is null
        and c.portal_permission = 'edit'
        and lower(c.email) = lower(coalesce(auth.jwt()->>'email',''))
    )
  )
);

drop policy if exists "client_files_delete" on storage.objects;
create policy "client_files_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'client-files'
  and (
    public.is_admin()
    or exists (
      select 1 from public.clients c
      where c.id = ((storage.foldername(name))[1])::uuid
        and c.deleted_at is null
        and c.portal_permission = 'edit'
        and lower(c.email) = lower(coalesce(auth.jwt()->>'email',''))
    )
  )
);
