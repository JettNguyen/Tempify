-- Premium given by hand, to a streamer or an early player, through a set day.
-- It lives apart from users because players can update their own users row,
-- and this has to be something only the admin can set. The app adds it on
-- top of a paid subscription and never writes it into is_subscribed, so it
-- runs out by itself.

create table if not exists premium_comps (
  user_id    uuid primary key references users(id) on delete cascade,
  until      date not null,
  note       text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);

alter table premium_comps enable row level security;

drop policy if exists "Players can see their own comp" on premium_comps;
create policy "Players can see their own comp"
  on premium_comps for select
  using (auth.uid() = user_id or is_admin());

drop policy if exists "Admin manages comps" on premium_comps;
create policy "Admin manages comps"
  on premium_comps for all
  using (is_admin())
  with check (is_admin());
