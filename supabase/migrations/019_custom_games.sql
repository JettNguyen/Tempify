-- Games a Tempify+ player makes for friends. They pick the songs; the app
-- fills in the answers (years and peaks from the Hot 100 list it ships) and
-- finds each song an Apple clip. A game plays at /game/<slug>?c=<id> for
-- anyone with the link, account or not. Playing one never touches streaks,
-- the daily leaderboards or the daily stats: a signed-in player's first score
-- goes on that game's own scoreboard instead.
--
-- Nobody reads or writes these tables directly. Everything goes through the
-- functions below, which check Premium and keep only the fields a game reads,
-- so a game can carry nothing but song names, Apple clips and answers.

create table if not exists custom_games (
  id         text primary key check (id ~ '^[a-f0-9]{10}$'),
  maker_id   uuid not null references users(id) on delete cascade,
  game_slug  text not null check (game_slug in ('one-bar', 'hit-or-miss', 'era')),
  rounds     jsonb not null check (jsonb_typeof(rounds) = 'array'),
  created_at timestamptz not null default now()
);

create index if not exists custom_games_maker_idx on custom_games (maker_id, created_at desc);

alter table custom_games enable row level security;

create table if not exists custom_game_scores (
  game_id    text not null references custom_games(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  -- Era and Hit or Miss: points, up to 1,000 a scored song.
  points     int check (points between 0 and 5000),
  -- One Bar: guesses taken, 0 for a miss.
  guesses    smallint check (guesses between 0 and 6),
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

alter table custom_game_scores enable row level security;

-- Premium the way profiles (migration 013) counts it: a paid plan on either
-- store, or a gift that hasn't run out. The app's email allowlist
-- (VITE_PREMIUM_EMAILS) lives only in the app, so it can't count here.
create or replace function has_premium(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from users u
     where u.id = p_user
       and (u.is_subscribed or u.stripe_subscribed or u.rc_subscribed)
  ) or exists (
    select 1 from premium_comps c
     where c.user_id = p_user
       and c.until >= (now() at time zone 'America/New_York')::date
  );
$$;

revoke all on function has_premium(uuid) from public;

-- Saves a game and returns its id. One Bar is one song; Era and Hit or Miss
-- are three to five. The app reads the error text, so keep these phrases:
-- 'premium only', 'too many today'.
create or replace function create_custom_game(p_game_slug text, p_rounds jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me    uuid := auth.uid();
  n     int;
  clean jsonb;
  code  text;
begin
  if me is null then
    raise exception 'sign in first';
  end if;
  if not (has_premium(me) or is_admin()) then
    raise exception 'premium only';
  end if;
  if p_game_slug is null or p_game_slug not in ('one-bar', 'hit-or-miss', 'era') then
    raise exception 'unknown game';
  end if;
  if jsonb_typeof(p_rounds) is distinct from 'array' then
    raise exception 'songs must be a list';
  end if;

  n := jsonb_array_length(p_rounds);
  if (p_game_slug = 'one-bar' and n <> 1) or (p_game_slug <> 'one-bar' and n not between 3 and 5) then
    raise exception 'wrong number of songs';
  end if;

  -- Plenty for anyone making games for friends, and a ceiling for a script.
  if (select count(*) from custom_games
       where maker_id = me and created_at > now() - interval '1 day') >= 25 then
    raise exception 'too many today';
  end if;

  -- Only the fields the game screens read, each one trimmed or checked.
  select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'title',          left(btrim(r ->> 'title'), 200),
           'artist',         left(btrim(r ->> 'artist'), 200),
           'audio_url',      r ->> 'audio_url',
           'artwork_url',    case when r ->> 'artwork_url' ~ '^https://[a-z0-9.-]+\.(mzstatic\.com|dzcdn\.net)/'
                                  then left(r ->> 'artwork_url', 500) end,
           'year',           case when p_game_slug <> 'one-bar' then (r ->> 'year')::int end,
           'peak',           case when p_game_slug = 'hit-or-miss' then (r ->> 'peak')::int end,
           'weeks_on_chart', case when p_game_slug = 'hit-or-miss' then (r ->> 'weeks_on_chart')::int end,
           'weeks_at_one',   case when p_game_slug = 'hit-or-miss' then (r ->> 'weeks_at_one')::int end
         )) order by i)
    into clean
    from jsonb_array_elements(p_rounds) with ordinality as t(r, i);

  -- Every clip is an Apple preview, the same kind the daily games play: they
  -- don't expire, and nothing else can be slipped in as a "clip".
  if exists (
    select 1 from jsonb_array_elements(clean) e
     where coalesce(e ->> 'title', '') = ''
        or coalesce(e ->> 'artist', '') = ''
        or coalesce(e ->> 'audio_url', '') !~ '^https://audio-ssl\.itunes\.apple\.com/'
        or length(e ->> 'audio_url') > 500
        or (p_game_slug = 'era'
            and coalesce((e ->> 'year')::int, 0) not between 1900 and extract(year from now())::int + 1)
        or (p_game_slug = 'hit-or-miss'
            and coalesce((e ->> 'peak')::int, -1) not between 0 and 100)
  ) then
    raise exception 'a song is missing its name, clip or answer';
  end if;

  loop
    code := left(replace(gen_random_uuid()::text, '-', ''), 10);
    begin
      insert into custom_games (id, maker_id, game_slug, rounds)
      values (code, me, p_game_slug, clean);
      return code;
    exception when unique_violation then
      -- Another game already has this id. Draw again.
    end;
  end loop;
end;
$$;

revoke all on function create_custom_game(text, jsonb) from public;
grant execute on function create_custom_game(text, jsonb) to authenticated;

-- One game, for anyone holding its link. Null when there's no such game.
create or replace function get_custom_game(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'code',       g.id,
           'game_slug',  g.game_slug,
           'rounds',     g.rounds,
           'maker_id',   g.maker_id,
           'maker',      u.username,
           'created_at', g.created_at)
    from custom_games g
    left join users u on u.id = g.maker_id
   where g.id = p_code;
$$;

revoke all on function get_custom_game(text) from public;
grant execute on function get_custom_game(text) to anon, authenticated;

-- The games the signed-in player made, newest first, with how many scores
-- each one has. Players without an account aren't counted: nothing of
-- theirs is stored.
create or replace function my_custom_games()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'code',       g.id,
           'game_slug',  g.game_slug,
           'rounds',     g.rounds,
           'created_at', g.created_at,
           'scores',     (select count(*) from custom_game_scores s where s.game_id = g.id)
         ) order by g.created_at desc), '[]'::jsonb)
    from custom_games g
   where g.maker_id = auth.uid();
$$;

revoke all on function my_custom_games() from public;
grant execute on function my_custom_games() to authenticated;

-- Its maker can take a game down. Its scores go with it.
create or replace function delete_custom_game(p_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from custom_games
     where id = p_code and maker_id = auth.uid()
    returning 1
  )
  select exists (select 1 from gone);
$$;

revoke all on function delete_custom_game(text) from public;
grant execute on function delete_custom_game(text) to authenticated;

-- A signed-in player's first finish of a game goes on its board; playing it
-- again changes nothing, the way a daily game's first play is the one that
-- counts. The maker knows the answers, so their plays stay off. True when
-- this call put a score up.
create or replace function save_custom_score(p_code text, p_points int default null, p_guesses int default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me     uuid := auth.uid();
  g      custom_games;
  scored int;
begin
  if me is null then
    return false;
  end if;
  select * into g from custom_games where id = p_code;
  if not found or g.maker_id = me then
    return false;
  end if;

  if g.game_slug = 'one-bar' then
    if p_guesses is null or p_guesses not between 0 and 6 then
      raise exception 'guesses out of range';
    end if;
    insert into custom_game_scores (game_id, user_id, guesses)
    values (p_code, me, p_guesses)
    on conflict do nothing;
  else
    -- Era's first song starts on the line with its year showing, so it
    -- scores nothing.
    scored := jsonb_array_length(g.rounds) - case when g.game_slug = 'era' then 1 else 0 end;
    if p_points is null or p_points not between 0 and scored * 1000 then
      raise exception 'points out of range';
    end if;
    insert into custom_game_scores (game_id, user_id, points)
    values (p_code, me, p_points)
    on conflict do nothing;
  end if;
  return found;
end;
$$;

revoke all on function save_custom_score(text, int, int) from public;
grant execute on function save_custom_score(text, int, int) to authenticated;

-- A game's scoreboard, best first: most points, or on One Bar the fewest
-- guesses with misses last, then whoever played first. The same rule as the
-- daily leaderboards decides who shows (on_leaderboard, migration 013), and a
-- player always sees their own row.
create or replace function get_custom_scores(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with shown as (
    select u.username,
           u.avatar_icon,
           u.avatar_color,
           s.points,
           s.guesses,
           coalesce(s.user_id = auth.uid(), false) as me,
           row_number() over (
             order by s.points desc nulls last,
                      case when s.guesses = 0 then 7 else s.guesses end,
                      s.created_at
           ) as place
      from custom_game_scores s
      join users u on u.id = s.user_id
     where s.game_id = p_code
       and u.username is not null
       and (on_leaderboard(s.user_id) or s.user_id = auth.uid())
  )
  select coalesce(
           (select jsonb_agg(to_jsonb(r) order by r.place)
              from (select * from shown order by place limit 50) r),
           '[]'::jsonb);
$$;

revoke all on function get_custom_scores(text) from public;
grant execute on function get_custom_scores(text) to anon, authenticated;
