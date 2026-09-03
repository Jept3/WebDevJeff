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


-- ============================================================
-- VA Time Tracking + Invoice Module
-- ============================================================

create table if not exists public.billing_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hourly_rate numeric(10,2) not null default 3.00,
  business_name text default 'Webdev VA',
  full_name text,
  email text,
  phone text,
  address text,
  payment_instructions text,
  updated_at timestamptz not null default now()
);

alter table public.billing_settings enable row level security;
grant select, insert, update on public.billing_settings to authenticated;

drop policy if exists "billing_settings_admin_own" on public.billing_settings;
create policy "billing_settings_admin_own"
on public.billing_settings for all
to authenticated
using (user_id = auth.uid() and public.is_admin())
with check (user_id = auth.uid() and public.is_admin());

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  task text,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  hours numeric(10,4),
  hourly_rate numeric(10,2) not null default 3.00,
  invoice_id uuid,
  created_at timestamptz not null default now()
);

alter table public.time_entries enable row level security;
grant select, insert, update, delete on public.time_entries to authenticated;

drop policy if exists "time_entries_admin_all" on public.time_entries;
create policy "time_entries_admin_all"
on public.time_entries for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "time_entries_client_view_own_project" on public.time_entries;
create policy "time_entries_client_view_own_project"
on public.time_entries for select
to authenticated
using (
  exists (
    select 1 from public.clients c
    where c.id=time_entries.client_id
      and c.deleted_at is null
      and lower(c.email)=lower(coalesce(auth.jwt()->>'email',''))
  )
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  invoice_number text not null unique,
  invoice_date date not null default current_date,
  period_start date,
  period_end date,
  hours numeric(10,2) not null default 0,
  hourly_rate numeric(10,2) not null default 3.00,
  total numeric(12,2) not null default 0,
  description text default 'Online Work',
  notes text,
  status text not null default 'pending' check (status in ('draft','pending','paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.invoices enable row level security;
grant select, insert, update, delete on public.invoices to authenticated;

drop policy if exists "invoices_admin_all" on public.invoices;
create policy "invoices_admin_all"
on public.invoices for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "invoices_client_view_own" on public.invoices;
create policy "invoices_client_view_own"
on public.invoices for select
to authenticated
using (
  exists (
    select 1 from public.clients c
    where c.id=invoices.client_id
      and c.deleted_at is null
      and lower(c.email)=lower(coalesce(auth.jwt()->>'email',''))
  )
);

-- Link time entries to invoices after invoices table exists.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='time_entries_invoice_id_fkey'
  ) then
    alter table public.time_entries
      add constraint time_entries_invoice_id_fkey
      foreign key (invoice_id) references public.invoices(id) on delete set null;
  end if;
end $$;


-- ============================================================
-- Jeffdesign101 Full Client Portal + Username-only Login
-- ============================================================

-- Client accounts now link directly to Auth users.
alter table public.clients
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists login_email text;

create unique index if not exists clients_auth_user_unique
on public.clients(auth_user_id)
where auth_user_id is not null;

-- Extra task fields for client-created detailed tasks.
alter table public.client_tasks
  add column if not exists details text,
  add column if not exists priority text default 'Normal',
  add column if not exists due_date date;

-- Direct account link replaces real-email matching.
drop policy if exists "clients_admin_select_all_client_select_own" on public.clients;
create policy "clients_admin_select_all_client_select_own"
on public.clients for select
to authenticated
using (
  public.is_admin()
  or (
    deleted_at is null
    and auth_user_id = auth.uid()
  )
);

-- Client submissions linked by project ownership instead of email.
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
      and c.auth_user_id = auth.uid()
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
        and c.auth_user_id = auth.uid()
    )
  )
)
with check (public.is_admin() or user_id = auth.uid());

-- Access helper updated for direct Auth user linkage.
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
        and c.auth_user_id = auth.uid()
    );
$$;

-- Tasks: clients can create detailed tasks for their own project if editing is enabled.
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
        and c.auth_user_id = auth.uid()
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
        and c.auth_user_id = auth.uid()
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
        and c.auth_user_id = auth.uid()
    )
  )
);

-- Time logs visible to directly linked client.
drop policy if exists "time_entries_client_view_own_project" on public.time_entries;
create policy "time_entries_client_view_own_project"
on public.time_entries for select
to authenticated
using (
  exists (
    select 1 from public.clients c
    where c.id=time_entries.client_id
      and c.deleted_at is null
      and c.auth_user_id=auth.uid()
  )
);

-- Invoices visible to directly linked client.
drop policy if exists "invoices_client_view_own" on public.invoices;
create policy "invoices_client_view_own"
on public.invoices for select
to authenticated
using (
  exists (
    select 1 from public.clients c
    where c.id=invoices.client_id
      and c.deleted_at is null
      and c.auth_user_id=auth.uid()
  )
);

-- Storage permissions use direct linked Auth account.
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
        and c.auth_user_id = auth.uid()
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
        and c.auth_user_id = auth.uid()
    )
  )
);

-- Username login resolver returns the hidden internal Auth email.
create or replace function public.resolve_login_email(login_name text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select login_email
  from public.clients
  where deleted_at is null
    and client_username is not null
    and lower(client_username) = lower(login_name)
    and login_email is not null
  limit 1;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;


-- ============================================================
-- Employer Portal correction
-- Employer supplies project information, shared notes, tasks, and files.
-- ============================================================

alter table public.client_submissions
  add column if not exists project_information text not null default '',
  add column if not exists shared_notes text not null default '';

-- Existing submission RLS continues to apply:
-- linked employer can edit when portal_permission = 'edit';
-- admin can read employer submissions.
