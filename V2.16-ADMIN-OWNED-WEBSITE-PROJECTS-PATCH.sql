-- Jeffdesign101 v2.16 — Admin-owned Website Production Controls
-- Run ONCE after the v2.13 + v2.14 website project patches.
-- Safe to rerun. Does not delete existing website project data.

-- Employer may create a Website Project, but production state always starts as draft
-- and showcase/production fields remain Admin-owned.
create or replace function public.guard_website_project_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  -- Employer must still own an editable, active client record.
  if not exists (
    select 1
    from public.clients c
    where c.id = old.client_id
      and c.auth_user_id = auth.uid()
      and c.portal_permission = 'edit'
      and c.deleted_at is null
  ) then
    raise exception 'Not permitted';
  end if;

  -- Employer may only update their supplied website information.
  if new.client_id is distinct from old.client_id
     or new.created_by is distinct from old.created_by
     or new.status is distinct from old.status
     or new.created_at is distinct from old.created_at
     or new.showcase_url is distinct from old.showcase_url
     or new.showcase_notes is distinct from old.showcase_notes
     or new.showcase_logo_path is distinct from old.showcase_logo_path
     or new.showcase_gallery is distinct from old.showcase_gallery
     or new.showcase_published is distinct from old.showcase_published
     or new.showcase_updated_at is distinct from old.showcase_updated_at
  then
    raise exception 'Employer may only edit site name, intake information and additional notes';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_website_project_update() from public;

drop trigger if exists guard_website_project_update_trigger on public.website_projects;
create trigger guard_website_project_update_trigger
before update on public.website_projects
for each row execute function public.guard_website_project_update();

-- Rebuild insert policy: Employer can create its own project only in the default
-- Admin-managed production state.
drop policy if exists "website_projects_insert" on public.website_projects;
create policy "website_projects_insert" on public.website_projects
for insert to authenticated
with check (
  public.is_admin()
  or (
    created_by = auth.uid()
    and status = 'draft'
    and coalesce(showcase_url,'') = ''
    and coalesce(showcase_notes,'') = ''
    and coalesce(showcase_logo_path,'') = ''
    and coalesce(showcase_gallery, '[]'::jsonb) = '[]'::jsonb
    and showcase_published = false
    and exists (
      select 1 from public.clients c
      where c.id = client_id
        and c.auth_user_id = auth.uid()
        and c.portal_permission = 'edit'
        and c.deleted_at is null
    )
  )
);

-- Employer no longer deletes website projects. Admin controls lifecycle/removal.
drop policy if exists "website_projects_delete" on public.website_projects;
create policy "website_projects_delete" on public.website_projects
for delete to authenticated
using (public.is_admin());
