-- Jeffdesign101 v2.18 — Project Asset Library + unified storage authorization
-- Run ONCE after v2.16/v2.17 migrations. Safe to rerun.
-- Does not delete existing storage objects or website project records.

create extension if not exists pgcrypto;

-- Canonical metadata table for files that belong to a specific Website Project.
create table if not exists public.website_project_assets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid not null references public.website_projects(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  category text not null default 'other' check (category in ('brand','photos','content','documents','references','other')),
  mime_type text not null default '',
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_by_role text not null default 'employer' check (uploaded_by_role in ('admin','employer')),
  created_at timestamptz not null default now()
);

create index if not exists website_project_assets_project_category_idx
  on public.website_project_assets(project_id, category, created_at desc);
create index if not exists website_project_assets_client_idx
  on public.website_project_assets(client_id, created_at desc);

alter table public.website_project_assets enable row level security;

-- Client-level helpers retained for legacy/shared objects.
create or replace function public.can_read_client_files(target_client uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_admin() or exists (
    select 1 from public.clients c
    where c.id = target_client and c.auth_user_id = auth.uid() and c.deleted_at is null
  );
$$;

create or replace function public.can_manage_client_files(target_client uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_admin() or exists (
    select 1 from public.clients c
    where c.id = target_client and c.auth_user_id = auth.uid()
      and c.portal_permission = 'edit' and c.deleted_at is null
  );
$$;

revoke all on function public.can_read_client_files(uuid) from public;
revoke all on function public.can_manage_client_files(uuid) from public;
grant execute on function public.can_read_client_files(uuid) to authenticated;
grant execute on function public.can_manage_client_files(uuid) to authenticated;

-- Project ownership helpers. SECURITY DEFINER avoids fragile nested RLS inside storage.objects policies.
create or replace function public.can_read_website_project_asset(target_client uuid, target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_admin() or exists (
    select 1
    from public.website_projects wp
    join public.clients c on c.id = wp.client_id
    where wp.id = target_project
      and wp.client_id = target_client
      and c.auth_user_id = auth.uid()
      and c.deleted_at is null
  );
$$;

create or replace function public.can_write_website_project_asset(target_client uuid, target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_admin() or exists (
    select 1
    from public.website_projects wp
    join public.clients c on c.id = wp.client_id
    where wp.id = target_project
      and wp.client_id = target_client
      and c.auth_user_id = auth.uid()
      and c.portal_permission = 'edit'
      and c.deleted_at is null
  );
$$;

revoke all on function public.can_read_website_project_asset(uuid,uuid) from public;
revoke all on function public.can_write_website_project_asset(uuid,uuid) from public;
grant execute on function public.can_read_website_project_asset(uuid,uuid) to authenticated;
grant execute on function public.can_write_website_project_asset(uuid,uuid) to authenticated;


create or replace function public.can_read_published_showcase(target_client uuid, target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_admin() or exists (
    select 1
    from public.website_projects wp
    join public.clients c on c.id = wp.client_id
    where wp.id = target_project
      and wp.client_id = target_client
      and wp.showcase_published = true
      and c.auth_user_id = auth.uid()
      and c.deleted_at is null
  );
$$;
revoke all on function public.can_read_published_showcase(uuid,uuid) from public;
grant execute on function public.can_read_published_showcase(uuid,uuid) to authenticated;

-- Metadata policies.
drop policy if exists "website_project_assets_read" on public.website_project_assets;
drop policy if exists "website_project_assets_insert" on public.website_project_assets;
drop policy if exists "website_project_assets_delete" on public.website_project_assets;

create policy "website_project_assets_read" on public.website_project_assets
for select to authenticated
using (public.can_read_website_project_asset(client_id, project_id));

create policy "website_project_assets_insert" on public.website_project_assets
for insert to authenticated
with check (
  public.can_write_website_project_asset(client_id, project_id)
  and (public.is_admin() or uploaded_by = auth.uid())
  and exists (
    select 1 from public.website_projects wp
    where wp.id = project_id and wp.client_id = client_id
  )
);

create policy "website_project_assets_delete" on public.website_project_assets
for delete to authenticated
using (public.can_write_website_project_asset(client_id, project_id));

grant select,insert,delete on public.website_project_assets to authenticated;

-- Replace all historical client-files policies with one predictable set.
drop policy if exists "client_files_select" on storage.objects;
drop policy if exists "client_files_insert" on storage.objects;
drop policy if exists "client_files_delete" on storage.objects;
drop policy if exists "website_project_assets_employer_insert" on storage.objects;
drop policy if exists "website_project_assets_employer_select" on storage.objects;
drop policy if exists "website_project_assets_employer_delete" on storage.objects;
drop policy if exists "client_files_admin_insert" on storage.objects;
drop policy if exists "client_files_admin_select" on storage.objects;
drop policy if exists "client_files_admin_delete" on storage.objects;
drop policy if exists "client_files_read_v2173" on storage.objects;
drop policy if exists "client_files_insert_v2173" on storage.objects;
drop policy if exists "client_files_delete_v2173" on storage.objects;
drop policy if exists "client_files_read_v218" on storage.objects;
drop policy if exists "client_files_insert_v218" on storage.objects;
drop policy if exists "client_files_delete_v218" on storage.objects;

-- Read any client-owned object, including legacy files. Admin can read all.
create policy "client_files_read_v218" on storage.objects
for select to authenticated
using (
  bucket_id = 'client-files'
  and (
    public.is_admin()
    or (
      split_part(name,'/',1) ~* '^[0-9a-f-]{36}$'
      and (
        -- Admin showcase is visible to Employer only after publish.
        (
          split_part(name,'/',2) = 'website-projects'
          and split_part(name,'/',3) ~* '^[0-9a-f-]{36}$'
          and split_part(name,'/',4) = 'showcase'
          and public.can_read_published_showcase(split_part(name,'/',1)::uuid, split_part(name,'/',3)::uuid)
        )
        -- Canonical and legacy project source assets are visible to the owning Employer.
        or (
          split_part(name,'/',2) = 'website-projects'
          and split_part(name,'/',3) ~* '^[0-9a-f-]{36}$'
          and split_part(name,'/',4) <> 'showcase'
          and public.can_read_website_project_asset(split_part(name,'/',1)::uuid, split_part(name,'/',3)::uuid)
        )
        -- Legacy generic files remain readable for compatibility.
        or (split_part(name,'/',2) <> 'website-projects' and public.can_read_client_files(split_part(name,'/',1)::uuid))
      )
    )
  )
);

-- New canonical Employer upload path:
-- <client-id>/website-projects/<project-id>/assets/<category>/<filename>
-- Admin can upload anywhere, including /showcase/.
create policy "client_files_insert_v218" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'client-files'
  and (
    public.is_admin()
    or (
      split_part(name,'/',1) ~* '^[0-9a-f-]{36}$'
      and split_part(name,'/',2) = 'website-projects'
      and split_part(name,'/',3) ~* '^[0-9a-f-]{36}$'
      and split_part(name,'/',4) = 'assets'
      and split_part(name,'/',5) in ('brand','photos','content','documents','references','other')
      and split_part(name,'/',6) <> ''
      and public.can_write_website_project_asset(
        split_part(name,'/',1)::uuid,
        split_part(name,'/',3)::uuid
      )
    )
  )
);

-- Employer can delete only canonical project assets. Admin can delete anywhere.
create policy "client_files_delete_v218" on storage.objects
for delete to authenticated
using (
  bucket_id = 'client-files'
  and (
    public.is_admin()
    or (
      split_part(name,'/',1) ~* '^[0-9a-f-]{36}$'
      and split_part(name,'/',2) = 'website-projects'
      and split_part(name,'/',3) ~* '^[0-9a-f-]{36}$'
      and split_part(name,'/',4) = 'assets'
      and split_part(name,'/',5) in ('brand','photos','content','documents','references','other')
      and public.can_write_website_project_asset(
        split_part(name,'/',1)::uuid,
        split_part(name,'/',3)::uuid
      )
    )
  )
);

-- Register pre-v2.18 direct project files as category "other" so they remain manageable.
-- Old path: <client-id>/website-projects/<project-id>/<filename>
insert into public.website_project_assets (
  client_id, project_id, storage_path, file_name, category, mime_type, size_bytes, uploaded_by, uploaded_by_role, created_at
)
select
  split_part(o.name,'/',1)::uuid,
  split_part(o.name,'/',3)::uuid,
  o.name,
  split_part(o.name,'/',4),
  'other',
  coalesce(o.metadata->>'mimetype',''),
  coalesce(nullif(o.metadata->>'size','')::bigint,0),
  null,
  'employer',
  coalesce(o.created_at,now())
from storage.objects o
join public.website_projects wp
  on wp.id = case when split_part(o.name,'/',3) ~* '^[0-9a-f-]{36}$' then split_part(o.name,'/',3)::uuid end
 and wp.client_id = case when split_part(o.name,'/',1) ~* '^[0-9a-f-]{36}$' then split_part(o.name,'/',1)::uuid end
where o.bucket_id = 'client-files'
  and split_part(o.name,'/',1) ~* '^[0-9a-f-]{36}$'
  and split_part(o.name,'/',2) = 'website-projects'
  and split_part(o.name,'/',3) ~* '^[0-9a-f-]{36}$'
  and split_part(o.name,'/',4) <> ''
  and split_part(o.name,'/',4) not in ('showcase','assets')
on conflict (storage_path) do nothing;
