-- Jeffdesign101 v2.21 — Dual Logo Variants + Asset Preview Support
-- Run once after v2.20/v2.19. Safe to rerun.

alter table public.website_projects
  add column if not exists showcase_logo_dark_path text not null default '';

-- Rebuild website-project update guard so the new dark-logo field remains Admin-only.
create or replace function public.guard_website_project_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if public.is_admin() then return new; end if;
  if not exists (select 1 from public.clients c where c.id=old.client_id and c.auth_user_id=auth.uid() and c.portal_permission='edit' and c.deleted_at is null) then
    raise exception 'Not permitted';
  end if;
  if new.client_id is distinct from old.client_id
     or new.created_by is distinct from old.created_by
     or new.status is distinct from old.status
     or new.created_at is distinct from old.created_at
     or new.showcase_url is distinct from old.showcase_url
     or new.showcase_notes is distinct from old.showcase_notes
     or new.showcase_logo_path is distinct from old.showcase_logo_path
     or new.showcase_logo_dark_path is distinct from old.showcase_logo_dark_path
     or new.showcase_gallery is distinct from old.showcase_gallery
     or new.showcase_published is distinct from old.showcase_published
     or new.showcase_updated_at is distinct from old.showcase_updated_at
  then raise exception 'Employer may only edit site name, intake information and additional notes'; end if;
  return new;
end;
$$;

revoke all on function public.guard_website_project_update() from public;

drop trigger if exists guard_website_project_update_trigger on public.website_projects;
create trigger guard_website_project_update_trigger
before update on public.website_projects
for each row execute function public.guard_website_project_update();

-- Ensure Employer-created projects cannot pre-populate Admin production logo variants.
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
    and coalesce(showcase_logo_dark_path,'') = ''
    and coalesce(showcase_gallery,'[]'::jsonb) = '[]'::jsonb
    and showcase_published = false
    and exists (select 1 from public.clients c where c.id=client_id and c.auth_user_id=auth.uid() and c.portal_permission='edit' and c.deleted_at is null)
  )
);


-- Keep the Project Activity timeline aware of either logo variant changing.
create or replace function public.log_website_project_changes()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_role text := public.website_project_actor_role();
  v_actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into public.website_project_events(client_id,project_id,actor_id,actor_role,event_type,title,details,metadata)
    values(new.client_id,new.id,v_actor,v_role,'project_created','Website project created',coalesce(new.website_name,'Untitled Website'),jsonb_build_object('status',new.status));
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.website_project_events(client_id,project_id,actor_id,actor_role,event_type,title,details,metadata)
    values(new.client_id,new.id,v_actor,v_role,'status_changed','Project status changed',coalesce(old.status,'draft') || ' → ' || coalesce(new.status,'draft'),jsonb_build_object('from',old.status,'to',new.status));
  end if;

  if new.website_intake is distinct from old.website_intake or new.website_notes is distinct from old.website_notes or new.website_name is distinct from old.website_name then
    insert into public.website_project_events(client_id,project_id,actor_id,actor_role,event_type,title,details)
    values(new.client_id,new.id,v_actor,v_role,'intake_updated','Project information updated',case when v_role='employer' then 'Employer updated website intake information.' else 'Admin updated project information.' end);
  end if;

  if new.showcase_logo_path is distinct from old.showcase_logo_path or new.showcase_logo_dark_path is distinct from old.showcase_logo_dark_path then
    insert into public.website_project_events(client_id,project_id,actor_id,actor_role,event_type,title,details,metadata)
    values(new.client_id,new.id,v_actor,v_role,'logo_updated','Website logo variants updated','A new light or dark logo proof is available.',jsonb_build_object('light_logo',coalesce(new.showcase_logo_path,'') <> '','dark_logo',coalesce(new.showcase_logo_dark_path,'') <> ''));
  end if;

  if new.showcase_gallery is distinct from old.showcase_gallery then
    insert into public.website_project_events(client_id,project_id,actor_id,actor_role,event_type,title,details,metadata)
    values(new.client_id,new.id,v_actor,v_role,'gallery_updated','Project screenshots updated','The website preview gallery changed.',jsonb_build_object('count',jsonb_array_length(coalesce(new.showcase_gallery,'[]'::jsonb))));
  end if;

  if new.showcase_url is distinct from old.showcase_url or new.showcase_notes is distinct from old.showcase_notes then
    insert into public.website_project_events(client_id,project_id,actor_id,actor_role,event_type,title,details)
    values(new.client_id,new.id,v_actor,v_role,'preview_updated','Website preview updated','Website link or Employer-facing update was changed.');
  end if;

  if new.showcase_published is distinct from old.showcase_published then
    insert into public.website_project_events(client_id,project_id,actor_id,actor_role,event_type,title,details,metadata)
    values(new.client_id,new.id,v_actor,v_role,
      case when new.showcase_published then 'showcase_published' else 'showcase_unpublished' end,
      case when new.showcase_published then 'Website preview published' else 'Website preview hidden' end,
      case when new.showcase_published then 'Employer can now view the production showcase.' else 'Production showcase is no longer visible to Employer.' end,
      jsonb_build_object('published',new.showcase_published));
  end if;
  return new;
end;
$$;
