-- Jeffdesign101 v2.6 - reliable Employer request delete
-- Safe to run on top of your existing schema. Does NOT delete or recreate tables/data.

create or replace function public.delete_own_task(target_task uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  deleted_count integer := 0;
begin
  delete from public.client_tasks t
  using public.clients c
  where t.id = target_task
    and c.id = t.client_id
    and t.user_id = auth.uid()
    and c.auth_user_id = auth.uid()
    and c.portal_permission = 'edit'
    and c.deleted_at is null;

  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end
$$;

revoke all on function public.delete_own_task(uuid) from public;
grant execute on function public.delete_own_task(uuid) to authenticated;

-- Keep the direct DELETE policy aligned as a fallback.
drop policy if exists "tasks_employer_delete" on public.client_tasks;
create policy "tasks_employer_delete" on public.client_tasks
for delete to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.clients c
    where c.id = client_id
      and c.auth_user_id = auth.uid()
      and c.portal_permission = 'edit'
      and c.deleted_at is null
  )
);
