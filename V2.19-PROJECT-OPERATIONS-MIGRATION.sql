-- Jeffdesign101 v2.19 — Project Operations / Activity Timeline
-- Run AFTER V2.18-PROJECT-ASSET-LIBRARY-MIGRATION.sql
-- Safe to rerun. Does not delete existing data.

create extension if not exists pgcrypto;

create table if not exists public.website_project_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid not null references public.website_projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text not null default 'system' check (actor_role in ('admin','employer','system')),
  event_type text not null,
  title text not null,
  details text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists website_project_events_project_created_idx
  on public.website_project_events(project_id, created_at desc);
create index if not exists website_project_events_client_created_idx
  on public.website_project_events(client_id, created_at desc);
create index if not exists website_project_events_created_idx
  on public.website_project_events(created_at desc);

alter table public.website_project_events enable row level security;

drop policy if exists "website_project_events_read" on public.website_project_events;
create policy "website_project_events_read" on public.website_project_events
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.clients c
    where c.id = website_project_events.client_id
      and c.auth_user_id = auth.uid()
      and c.deleted_at is null
  )
);

revoke all on public.website_project_events from anon;
revoke insert,update,delete on public.website_project_events from authenticated;
grant select on public.website_project_events to authenticated;

create or replace function public.website_project_actor_role()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case
    when auth.uid() is null then 'system'
    when public.is_admin() then 'admin'
    else 'employer'
  end;
$$;
revoke all on function public.website_project_actor_role() from public;
grant execute on function public.website_project_actor_role() to authenticated;

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

  if new.showcase_logo_path is distinct from old.showcase_logo_path then
    insert into public.website_project_events(client_id,project_id,actor_id,actor_role,event_type,title,details)
    values(new.client_id,new.id,v_actor,v_role,'logo_updated','Website logo updated','A new logo proof is available.');
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
      jsonb_build_object('published',new.showcase_published)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists website_project_change_events_trigger on public.website_projects;
create trigger website_project_change_events_trigger
after insert or update on public.website_projects
for each row execute function public.log_website_project_changes();

create or replace function public.log_website_project_asset_changes()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v public.website_project_assets%rowtype;
  v_role text := public.website_project_actor_role();
  v_actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then v := new; else v := old; end if;
  insert into public.website_project_events(client_id,project_id,actor_id,actor_role,event_type,title,details,metadata)
  values(
    v.client_id,v.project_id,v_actor,v_role,
    case when tg_op='INSERT' then 'asset_uploaded' else 'asset_deleted' end,
    case when tg_op='INSERT' then 'Project asset uploaded' else 'Project asset removed' end,
    v.file_name,
    jsonb_build_object('category',v.category,'file_name',v.file_name,'uploaded_by_role',v.uploaded_by_role)
  );
  if tg_op = 'INSERT' then return new; else return old; end if;
end;
$$;

drop trigger if exists website_project_asset_events_trigger on public.website_project_assets;
create trigger website_project_asset_events_trigger
after insert or delete on public.website_project_assets
for each row execute function public.log_website_project_asset_changes();

-- Seed one baseline event for existing projects that do not yet have timeline history.
insert into public.website_project_events(client_id,project_id,actor_role,event_type,title,details,metadata,created_at)
select wp.client_id,wp.id,'system','project_baseline','Project added to activity timeline',coalesce(wp.website_name,'Untitled Website'),jsonb_build_object('status',wp.status),coalesce(wp.created_at,now())
from public.website_projects wp
where not exists (select 1 from public.website_project_events e where e.project_id=wp.id)
on conflict do nothing;
