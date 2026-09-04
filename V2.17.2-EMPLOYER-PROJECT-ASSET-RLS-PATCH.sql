-- Jeffdesign101 v2.17.2
-- Employer Website Project asset Storage RLS hotfix
-- Safe to run more than once. Does not delete project data or files.

-- These policies are intentionally specific to:
--   client-files/<client-id>/website-projects/<project-id>/<filename>
-- Employers must own the client, have edit permission, and the project must belong
-- to that same client. The Admin-only `showcase` subtree remains blocked.

drop policy if exists "website_project_assets_employer_insert" on storage.objects;
create policy "website_project_assets_employer_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'client-files'
  and split_part(name, '/', 2) = 'website-projects'
  and split_part(name, '/', 4) <> 'showcase'
  and exists (
    select 1
    from public.website_projects wp
    join public.clients c on c.id = wp.client_id
    where wp.id::text = split_part(storage.objects.name, '/', 3)
      and c.id::text = split_part(storage.objects.name, '/', 1)
      and c.auth_user_id = auth.uid()
      and c.portal_permission = 'edit'
      and c.deleted_at is null
  )
);

drop policy if exists "website_project_assets_employer_select" on storage.objects;
create policy "website_project_assets_employer_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'client-files'
  and split_part(name, '/', 2) = 'website-projects'
  and split_part(name, '/', 4) <> 'showcase'
  and exists (
    select 1
    from public.website_projects wp
    join public.clients c on c.id = wp.client_id
    where wp.id::text = split_part(storage.objects.name, '/', 3)
      and c.id::text = split_part(storage.objects.name, '/', 1)
      and c.auth_user_id = auth.uid()
      and c.deleted_at is null
  )
);

drop policy if exists "website_project_assets_employer_delete" on storage.objects;
create policy "website_project_assets_employer_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'client-files'
  and split_part(name, '/', 2) = 'website-projects'
  and split_part(name, '/', 4) <> 'showcase'
  and exists (
    select 1
    from public.website_projects wp
    join public.clients c on c.id = wp.client_id
    where wp.id::text = split_part(storage.objects.name, '/', 3)
      and c.id::text = split_part(storage.objects.name, '/', 1)
      and c.auth_user_id = auth.uid()
      and c.portal_permission = 'edit'
      and c.deleted_at is null
  )
);
