-- security definer lets this function read auth.users as the DB owner.
-- Plain RLS policies run as the authenticated role which can't query auth.users,
-- so the subquery would return null and the policy would silently deny everything.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
    and email = 'jettuf26@gmail.com'
  );
$$;

drop policy if exists "Admin can manage puzzles" on puzzles;

create policy "Admin can manage puzzles"
  on puzzles for all
  using (is_admin())
  with check (is_admin());
