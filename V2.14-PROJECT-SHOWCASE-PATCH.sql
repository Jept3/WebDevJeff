-- Jeffdesign101 v2.14 — Website Project Showcase
-- Run ONCE after v2.13. Safe to rerun. Does not delete existing data.

alter table public.website_projects
  add column if not exists showcase_url text not null default '',
  add column if not exists showcase_notes text not null default '',
  add column if not exists showcase_logo_path text not null default '',
  add column if not exists showcase_gallery jsonb not null default '[]'::jsonb,
  add column if not exists showcase_published boolean not null default false,
  add column if not exists showcase_updated_at timestamptz;

-- Existing website_projects RLS from v2.13 already allows Admin updates and
-- Employer read access to their own project. Storage remains private and uses
-- the existing client-files policies. Showcase files are stored below:
-- <client_id>/website-projects/<project_id>/showcase/logo/
-- <client_id>/website-projects/<project_id>/showcase/gallery/
