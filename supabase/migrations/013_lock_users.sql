-- Every player's row in users was readable by anyone holding the app's public
-- key, emails included ("Public profiles are readable", made in the dashboard),
-- and a signed-in player could write any column of their own row, Premium
-- flags and email too. From here a player reads and changes only their own
-- row, and only the settings a player should change. Everyone else is seen
-- through profiles, which leaves out email and billing.

-- The public face of a player: what search, leaderboards and profile pages
-- show. It reads past users' row security as its owner, which is the point,
-- so it must only ever list columns anyone may see. A gift from Admin
-- (migration 012) shows as Premium here too.
create or replace view profiles as
  select u.id,
         u.username,
         u.avatar_icon,
         u.avatar_color,
         u.leaderboard_visibility,
         (u.is_subscribed or exists (
            select 1 from premium_comps c
             where c.user_id = u.id
               and c.until >= (now() at time zone 'America/New_York')::date
         )) as is_subscribed
    from users u;

-- Read only. A view this simple accepts writes, and a write through it would
-- run as the owner, past every rule on users.
revoke all on profiles from anon, authenticated;
grant select on profiles to anon, authenticated;

drop policy if exists "Public profiles are readable" on users;
-- "Users can read own profile" (auth.uid() = id) stays.

-- What a player can write: their own settings, and their own row once, with
-- the email they signed in with. Premium flags, Stripe ids and the email
-- itself belong to the webhooks, which use the service role.
revoke all on users from anon, authenticated;
grant select on users to authenticated;
grant insert (id, email) on users to authenticated;
grant update (username, avatar_icon, avatar_color, leaderboard_visibility, autoplay_audio, competitive_mode)
  on users to authenticated;

drop policy if exists "Users can insert own profile" on users;
create policy "Users can insert own profile"
  on users for insert
  with check (auth.uid() = id and email is not distinct from (auth.jwt() ->> 'email'));

-- The leaderboard's score policy looked players up in users as the reader,
-- who can now see only their own row, so the lookup moves into a function
-- that answers yes or no and nothing more. Same rule as before.
create or replace function on_leaderboard(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from users
     where id = p_user
       and leaderboard_visibility in ('public', 'followers')
  );
$$;

revoke all on function on_leaderboard(uuid) from public;
grant execute on function on_leaderboard(uuid) to anon, authenticated;

drop policy if exists "Scores readable for leaderboard" on scores;
create policy "Scores readable for leaderboard"
  on scores for select
  using (auth.uid() = user_id or (completed = true and on_leaderboard(user_id)));

-- Search: part of a username, or an exact email someone already knows. The
-- email is matched here and never sent back.
create or replace function search_profiles(p_query text)
returns setof profiles
language sql
stable
security definer
set search_path = public
as $$
  select p.*
    from profiles p
    join users u on u.id = p.id
   where p.username is not null
     and (p.username ilike '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
          or lower(u.email) = lower(trim(p_query)))
   order by p.username
   limit 10;
$$;

revoke all on function search_profiles(text) from public;
grant execute on function search_profiles(text) to authenticated;
