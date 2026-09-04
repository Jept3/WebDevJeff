-- Jeffdesign101 v2.12 Website Workspace patch
-- Run ONCE in Supabase SQL Editor. Safe to rerun.
-- Adds Employer Website Intake + Admin Prompt Library. Does not delete existing data.

create extension if not exists pgcrypto;

alter table public.client_submissions
  add column if not exists website_name text not null default '',
  add column if not exists website_intake jsonb not null default '{}'::jsonb,
  add column if not exists website_notes text not null default '';

create table if not exists public.website_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'Website',
  prompt_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists website_prompts_user_updated_idx
  on public.website_prompts(user_id, updated_at desc);

alter table public.website_prompts enable row level security;

drop policy if exists "website_prompts_admin_read" on public.website_prompts;
drop policy if exists "website_prompts_admin_insert" on public.website_prompts;
drop policy if exists "website_prompts_admin_update" on public.website_prompts;
drop policy if exists "website_prompts_admin_delete" on public.website_prompts;

create policy "website_prompts_admin_read" on public.website_prompts
for select to authenticated
using (public.is_admin() and user_id = auth.uid());

create policy "website_prompts_admin_insert" on public.website_prompts
for insert to authenticated
with check (public.is_admin() and user_id = auth.uid());

create policy "website_prompts_admin_update" on public.website_prompts
for update to authenticated
using (public.is_admin() and user_id = auth.uid())
with check (public.is_admin() and user_id = auth.uid());

create policy "website_prompts_admin_delete" on public.website_prompts
for delete to authenticated
using (public.is_admin() and user_id = auth.uid());

grant select,insert,update,delete on public.website_prompts to authenticated;
