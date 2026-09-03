-- Jeffdesign101 CLEAN MIGRATION v1
-- Run this ONCE in Supabase SQL Editor. It is safe to rerun.

create extension if not exists pgcrypto;

-- ---------- helpers ----------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin');
$$;

-- ---------- columns ----------
alter table public.clients
  add column if not exists client_username text,
  add column if not exists portal_permission text not null default 'edit',
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists login_email text;

alter table public.client_submissions
  add column if not exists info_html text not null default '',
  add column if not exists project_information text not null default '',
  add column if not exists shared_notes text not null default '';

alter table public.client_tasks
  add column if not exists details text,
  add column if not exists priority text default 'Normal',
  add column if not exists due_date date,
  add column if not exists admin_seen_at timestamptz;

create unique index if not exists clients_username_lower_unique on public.clients(lower(client_username))
where client_username is not null and client_username<>'';
create unique index if not exists clients_auth_user_unique on public.clients(auth_user_id)
where auth_user_id is not null;

-- ---------- login resolver ----------
create or replace function public.resolve_login_email(login_name text)
returns text
language sql
stable
security definer
set search_path=public
as $$
  select c.login_email
  from public.clients c
  where c.deleted_at is null
    and c.client_username is not null
    and lower(c.client_username)=lower(login_name)
    and c.login_email is not null
  limit 1;
$$;
revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon,authenticated;

-- ---------- direct access helper ----------
create or replace function public.can_access_client(target_client uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.is_admin() or exists(
    select 1 from public.clients c
    where c.id=target_client and c.deleted_at is null and c.auth_user_id=auth.uid()
  );
$$;
revoke all on function public.can_access_client(uuid) from public;
grant execute on function public.can_access_client(uuid) to authenticated;

-- ---------- employer may only change status on clients ----------
create or replace function public.guard_client_update()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if public.is_admin() then return new; end if;
  if old.auth_user_id<>auth.uid() then raise exception 'Not permitted'; end if;
  if new.status not in ('ongoing','paused','complete') then raise exception 'Invalid status'; end if;

  if new.name is distinct from old.name
  or new.company is distinct from old.company
  or new.email is distinct from old.email
  or new.phone is distinct from old.phone
  or new.website is distinct from old.website
  or new.project_type is distinct from old.project_type
  or new.priority is distinct from old.priority
  or new.start_date is distinct from old.start_date
  or new.deadline is distinct from old.deadline
  or new.completed_date is distinct from old.completed_date
  or new.budget is distinct from old.budget
  or new.overview is distinct from old.overview
  or new.hosting is distinct from old.hosting
  or new.stack is distinct from old.stack
  or new.registrar is distinct from old.registrar
  or new.contact is distinct from old.contact
  or new.deliverables is distinct from old.deliverables
  or new.notes is distinct from old.notes
  or new.tags is distinct from old.tags
  or new.deleted_at is distinct from old.deleted_at
  or new.client_username is distinct from old.client_username
  or new.portal_permission is distinct from old.portal_permission
  or new.auth_user_id is distinct from old.auth_user_id
  or new.login_email is distinct from old.login_email
  then raise exception 'Employer may only change project status'; end if;
  return new;
end $$;

drop trigger if exists guard_employer_client_update_trigger on public.clients;
drop trigger if exists guard_client_update_trigger on public.clients;
create trigger guard_client_update_trigger before update on public.clients
for each row execute procedure public.guard_client_update();

-- ---------- task update ownership ----------
create or replace function public.guard_task_update()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if public.is_admin() then
    if new.task is distinct from old.task
    or new.details is distinct from old.details
    or new.priority is distinct from old.priority
    or new.due_date is distinct from old.due_date
    or new.client_id is distinct from old.client_id
    or new.user_id is distinct from old.user_id
    or new.created_at is distinct from old.created_at
    then raise exception 'Admin cannot edit Employer task content'; end if;
    return new;
  end if;

  if old.user_id<>auth.uid() then raise exception 'Not permitted'; end if;
  if new.done is distinct from old.done
  or new.admin_seen_at is distinct from old.admin_seen_at
  or new.client_id is distinct from old.client_id
  or new.user_id is distinct from old.user_id
  or new.created_at is distinct from old.created_at
  then raise exception 'Employer cannot change task workflow fields'; end if;
  return new;
end $$;

drop trigger if exists guard_admin_task_update_trigger on public.client_tasks;
drop trigger if exists guard_task_update_trigger on public.client_tasks;
create trigger guard_task_update_trigger before update on public.client_tasks
for each row execute procedure public.guard_task_update();

-- ---------- RLS reset ----------
alter table public.clients enable row level security;
alter table public.client_submissions enable row level security;
alter table public.client_tasks enable row level security;
alter table public.time_entries enable row level security;
alter table public.invoices enable row level security;
alter table public.billing_settings enable row level security;

drop policy if exists "clients_admin_select_all_client_select_own" on public.clients;
drop policy if exists "clients_admin_insert" on public.clients;
drop policy if exists "clients_admin_update" on public.clients;
drop policy if exists "clients_admin_delete" on public.clients;
drop policy if exists "clients_employer_update_status" on public.clients;

create policy "clients_read" on public.clients for select to authenticated
using(public.is_admin() or (deleted_at is null and auth_user_id=auth.uid()));
create policy "clients_admin_insert" on public.clients for insert to authenticated
with check(public.is_admin());
create policy "clients_update" on public.clients for update to authenticated
using(public.is_admin() or (deleted_at is null and auth_user_id=auth.uid()))
with check(public.is_admin() or (deleted_at is null and auth_user_id=auth.uid()));
create policy "clients_admin_delete" on public.clients for delete to authenticated
using(public.is_admin());

drop policy if exists "submissions_select" on public.client_submissions;
drop policy if exists "submissions_insert_own_client" on public.client_submissions;
drop policy if exists "submissions_update_own" on public.client_submissions;
create policy "submissions_read" on public.client_submissions for select to authenticated
using(public.is_admin() or public.can_access_client(client_id));
create policy "submissions_employer_insert" on public.client_submissions for insert to authenticated
with check(user_id=auth.uid() and exists(select 1 from public.clients c where c.id=client_id and c.auth_user_id=auth.uid() and c.portal_permission='edit' and c.deleted_at is null));
create policy "submissions_employer_update" on public.client_submissions for update to authenticated
using(user_id=auth.uid() and exists(select 1 from public.clients c where c.id=client_id and c.auth_user_id=auth.uid() and c.portal_permission='edit' and c.deleted_at is null))
with check(user_id=auth.uid());

drop policy if exists "tasks_select_accessible_project" on public.client_tasks;
drop policy if exists "tasks_insert_editable_project" on public.client_tasks;
drop policy if exists "tasks_update_editable_project" on public.client_tasks;
drop policy if exists "tasks_delete_editable_project" on public.client_tasks;
create policy "tasks_read" on public.client_tasks for select to authenticated
using(public.is_admin() or public.can_access_client(client_id));
create policy "tasks_employer_insert" on public.client_tasks for insert to authenticated
with check(user_id=auth.uid() and exists(select 1 from public.clients c where c.id=client_id and c.auth_user_id=auth.uid() and c.portal_permission='edit' and c.deleted_at is null));
create policy "tasks_update" on public.client_tasks for update to authenticated
using(public.is_admin() or (user_id=auth.uid() and public.can_access_client(client_id)))
with check(public.is_admin() or user_id=auth.uid());
create policy "tasks_employer_delete" on public.client_tasks for delete to authenticated
using(user_id=auth.uid() and exists(select 1 from public.clients c where c.id=client_id and c.auth_user_id=auth.uid() and c.portal_permission='edit'));

drop policy if exists "time_entries_admin_all" on public.time_entries;
drop policy if exists "time_entries_client_view_own_project" on public.time_entries;
create policy "time_admin_all" on public.time_entries for all to authenticated
using(public.is_admin()) with check(public.is_admin());
create policy "time_employer_read" on public.time_entries for select to authenticated
using(exists(select 1 from public.clients c where c.id=time_entries.client_id and c.auth_user_id=auth.uid() and c.deleted_at is null));

drop policy if exists "invoices_admin_all" on public.invoices;
drop policy if exists "invoices_client_view_own" on public.invoices;
create policy "invoice_admin_all" on public.invoices for all to authenticated
using(public.is_admin()) with check(public.is_admin());
create policy "invoice_employer_read" on public.invoices for select to authenticated
using(exists(select 1 from public.clients c where c.id=invoices.client_id and c.auth_user_id=auth.uid() and c.deleted_at is null));

drop policy if exists "billing_settings_admin_own" on public.billing_settings;
drop policy if exists "billing_settings_employer_invoice_read" on public.billing_settings;
create policy "billing_admin_all" on public.billing_settings for all to authenticated
using(public.is_admin() and user_id=auth.uid()) with check(public.is_admin() and user_id=auth.uid());
create policy "billing_employer_read" on public.billing_settings for select to authenticated
using(exists(select 1 from public.profiles p where p.id=billing_settings.user_id and p.role='admin'));

-- ---------- storage ----------
insert into storage.buckets(id,name,public) values('client-files','client-files',false)
on conflict(id) do update set public=false;

drop policy if exists "client_files_select" on storage.objects;
drop policy if exists "client_files_insert" on storage.objects;
drop policy if exists "client_files_delete" on storage.objects;
create policy "client_files_select" on storage.objects for select to authenticated
using(bucket_id='client-files' and public.can_access_client(((storage.foldername(name))[1])::uuid));
create policy "client_files_insert" on storage.objects for insert to authenticated
with check(bucket_id='client-files' and (
  public.is_admin() or exists(select 1 from public.clients c where c.id=((storage.foldername(name))[1])::uuid and c.auth_user_id=auth.uid() and c.portal_permission='edit' and c.deleted_at is null)
));
create policy "client_files_delete" on storage.objects for delete to authenticated
using(bucket_id='client-files' and (
  public.is_admin() or exists(select 1 from public.clients c where c.id=((storage.foldername(name))[1])::uuid and c.auth_user_id=auth.uid() and c.portal_permission='edit' and c.deleted_at is null)
));

-- Grants
grant select,insert,update,delete on public.clients to authenticated;
grant select,insert,update on public.client_submissions to authenticated;
grant select,insert,update,delete on public.client_tasks to authenticated;
grant select,insert,update,delete on public.time_entries to authenticated;
grant select,insert,update,delete on public.invoices to authenticated;
grant select,insert,update on public.billing_settings to authenticated;
