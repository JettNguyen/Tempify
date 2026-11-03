-- The Tempify bot's side of Admin: what it drafted for Jett to look at, and a
-- log of what it did. Only the admin sees or changes either. The bot writes
-- with the same access it uses for puzzles; the service role skips these
-- policies, and an admin session passes them.

-- One thing for Jett to look at. A post he posts himself, a puzzle the bot
-- already put live, or a note. He answers with a status:
--   waiting    new, or changed after he sent it back
--   approved   fine as it is
--   sent_back  change it; his note says how
--   posted     a post he put up, with the link if he gave one
create table if not exists agent_items (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('post', 'puzzle', 'note')),
  title       text not null check (char_length(title) between 1 and 200),
  body        text not null default '' check (char_length(body) <= 10000),
  place       text check (char_length(place) <= 120),
  due_on      date,
  game_slug   text,
  puzzle_date date,
  status      text not null default 'waiting'
              check (status in ('waiting', 'approved', 'sent_back', 'posted')),
  note        text check (char_length(note) <= 1000),
  link        text check (char_length(link) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  decided_at  timestamptz
);

create index if not exists agent_items_status_idx on agent_items (status, due_on);

-- So the bot can ask "what changed since I last looked" with one column.
create or replace function agent_items_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists agent_items_touch on agent_items;
create trigger agent_items_touch
  before update on agent_items
  for each row execute function agent_items_touch();

create table if not exists agent_log (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  summary text not null check (char_length(summary) between 1 and 300),
  failed  boolean not null default false,
  detail  jsonb
);

create index if not exists agent_log_at_idx on agent_log (at desc);

alter table agent_items enable row level security;
alter table agent_log enable row level security;

revoke all on agent_items from anon;
revoke all on agent_log from anon;

drop policy if exists "Admin manages agent items" on agent_items;
create policy "Admin manages agent items"
  on agent_items for all
  using (is_admin())
  with check (is_admin());

drop policy if exists "Admin manages the agent log" on agent_log;
create policy "Admin manages the agent log"
  on agent_log for all
  using (is_admin())
  with check (is_admin());
