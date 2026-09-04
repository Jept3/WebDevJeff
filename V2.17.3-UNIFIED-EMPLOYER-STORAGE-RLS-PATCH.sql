-- Jeffdesign101 v2.17.3
-- Unified Employer Storage RLS repair
-- Safe to rerun. Does not delete files or application data.
-- Replaces fragmented client-files policies with SECURITY DEFINER ownership helpers.

-- 1) Ownership helper: bypasses nested clients RLS safely.
create or replace function public.can_manage_client_files(target_client uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_admin() or exists (
    select 1
    from public.clients c
    where c.id = target_client
      and c.auth_user_id = auth.uid()
      and c.portal_permission = 'edit'
      and c.deleted_at is null
  );
$$;
revoke all on function public.can_manage_client_files(uuid) from public;
grant execute on function public.can_manage_client_files(uuid) to authenticated;

-- Read helper does not require edit permission, so View Only employers can still see files.
create or replace function public.can_read_client_files(target_client uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_admin() or exists (
    select 1
    from public.clients c
    where c.id = target_client
      and c.auth_user_id = auth.uid()
      and c.deleted_at is null
  );
$$;
revoke all on function public.can_read_client_files(uuid) from public;
grant execute on function public.can_read_client_files(uuid) to authenticated;

-- Project helper confirms the project belongs to the same authenticated Employer.
create or replace function public.can_manage_website_project_files(target_client uuid, target_project uuid)
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
      and c.id = target_client
      and c.auth_user_id = auth.uid()
      and c.portal_permission = 'edit'
      and c.deleted_at is null
  );
$$;
revoke all on function public.can_manage_website_project_files(uuid,uuid) from public;
grant execute on function public.can_manage_website_project_files(uuid,uuid) to authenticated;

-- 2) Remove all old policies used by previous builds so there is one predictable rule set.
drop policy if exists "client_files_select" on storage.objects;
drop policy if exists "client_files_insert" on storage.objects;
drop policy if exists "client_files_delete" on storage.objects;
drop policy if exists "website_project_assets_employer_insert" on storage.objects;
drop policy if exists "website_project_assets_employer_select" on storage.objects;
drop policy if exists "website_project_assets_employer_delete" on storage.objects;
drop policy if exists "client_files_admin_insert" on storage.objects;
drop policy if exists "client_files_admin_select" on storage.objects;
drop policy if exists "client_files_admin_delete" on storage.objects;

-- 3) Unified SELECT.
-- Client id is always folder segment 1. Admin can read all client-files.
create policy "client_files_read_v2173"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'client-files'
  and (
    public.is_admin()
    or (
      split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and public.can_read_client_files(split_part(name,'/',1)::uuid)
    )
  )
);

-- 4) Unified INSERT.
-- Admin may upload anywhere in client-files.
-- Employer may upload normal client files (client-id/file), legacy website-assets,
-- and their own website-project project-assets. Employer is explicitly blocked from showcase.
create policy "client_files_insert_v2173"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'client-files'
  and (
    public.is_admin()
    or (
      split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and public.can_manage_client_files(split_part(name,'/',1)::uuid)
      and (
        -- Normal Employer Files page: <client-id>/<filename>
        (split_part(name,'/',2) <> '' and split_part(name,'/',3) = '')
        -- Legacy website intake assets: <client-id>/website-assets/<filename>
        or split_part(name,'/',2) = 'website-assets'
        -- Multi-project intake assets: <client-id>/website-projects/<project-id>/<filename>
        or (
          split_part(name,'/',2) = 'website-projects'
          and split_part(name,'/',3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          and split_part(name,'/',4) <> 'showcase'
          and public.can_manage_website_project_files(
            split_part(name,'/',1)::uuid,
            split_part(name,'/',3)::uuid
          )
        )
      )
    )
  )
);

-- 5) Unified DELETE. Same ownership restrictions as uploads; Admin may delete anywhere.
create policy "client_files_delete_v2173"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'client-files'
  and (
    public.is_admin()
    or (
      split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and public.can_manage_client_files(split_part(name,'/',1)::uuid)
      and (
        (split_part(name,'/',2) <> '' and split_part(name,'/',3) = '')
        or split_part(name,'/',2) = 'website-assets'
        or (
          split_part(name,'/',2) = 'website-projects'
          and split_part(name,'/',3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          and split_part(name,'/',4) <> 'showcase'
          and public.can_manage_website_project_files(
            split_part(name,'/',1)::uuid,
            split_part(name,'/',3)::uuid
          )
        )
      )
    )
  )
);
