-- Anonymous play counts: whether anyone is playing, whether they come back,
-- and how they found Tempify. Nothing here can tell one player from another:
-- no user id, no device id, no time of day. A row says only that some device
-- finished a game, or shared one.

create table if not exists plays (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('finish', 'share')),
  game_slug   text not null check (game_slug ~ '^[a-z-]{2,32}$'),
  puzzle_date date not null,
  -- The day it happened, Eastern, the day the daily puzzles turn over on.
  played_on   date not null default (now() at time zone 'America/New_York')::date,
  platform    text not null check (platform in ('web', 'ios')),
  -- How the visit started: a challenge link (vs=), a shared link (s=share),
  -- or anything else.
  arrived     text not null check (arrived in ('challenge', 'share', 'direct')),
  -- The site the visit came from, host only ("reddit.com"), when the browser
  -- says.
  referrer    text check (char_length(referrer) <= 100),
  -- Finishes: whether it was the device's first finish that day, and on how
  -- many of the seven days before it the device finished something.
  first_today boolean,
  recent_days smallint check (recent_days between 0 and 7),
  -- Shares: whether the link carried a score to beat.
  challenge   boolean,
  signed_in   boolean not null default false
);

create index if not exists plays_played_on_idx on plays (played_on);

-- No policies, so nobody reads or writes the table directly: count_play()
-- adds rows and get_play_counts() reads them back for the admin.
alter table plays enable row level security;

create or replace function count_play(
  p_kind        text,
  p_game_slug   text,
  p_puzzle_date date,
  p_platform    text,
  p_arrived     text,
  p_referrer    text    default null,
  p_first_today boolean default null,
  p_recent_days int     default null,
  p_challenge   boolean default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into plays (kind, game_slug, puzzle_date, platform, arrived, referrer,
                     first_today, recent_days, challenge, signed_in)
  select p_kind, p_game_slug, p_puzzle_date, p_platform, p_arrived,
         nullif(left(lower(p_referrer), 100), ''),
         case when p_kind = 'finish' then p_first_today end,
         case when p_kind = 'finish' then p_recent_days end,
         case when p_kind = 'share'  then p_challenge end,
         auth.uid() is not null
   -- Day one through tomorrow, so a clock a little ahead still counts.
   where p_puzzle_date between date '2026-04-28'
                           and (now() at time zone 'America/New_York')::date + 1
     -- The admin's own plays would swamp the numbers while they're small.
     and not is_admin();
$$;

revoke all on function count_play(text, text, date, text, text, text, boolean, int, boolean) from public;
grant execute on function count_play(text, text, date, text, text, text, boolean, int, boolean) to anon, authenticated;

-- The admin's numbers for the last p_days days, newest first. A player is a
-- device's first finish of the day, so someone who plays all five games
-- counts once.
create or replace function get_play_counts(p_days int default 14)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  since date := (now() at time zone 'America/New_York')::date - greatest(p_days, 1) + 1;
begin
  if not is_admin() then
    raise exception 'admin only';
  end if;

  return jsonb_build_object(
    'days', coalesce((
      select jsonb_agg(day order by played_on desc)
        from (
          select played_on, jsonb_build_object(
                   'day',             played_on,
                   'players',         count(*) filter (where kind = 'finish' and first_today),
                   'ios',             count(*) filter (where kind = 'finish' and first_today and platform = 'ios'),
                   'signed_in',       count(*) filter (where kind = 'finish' and first_today and signed_in),
                   'new',             count(*) filter (where kind = 'finish' and first_today and recent_days = 0),
                   'regulars',        count(*) filter (where kind = 'finish' and first_today and recent_days >= 3),
                   'from_challenge',  count(*) filter (where kind = 'finish' and first_today and arrived = 'challenge'),
                   'from_share',      count(*) filter (where kind = 'finish' and first_today and arrived = 'share'),
                   'finishes',        count(*) filter (where kind = 'finish'),
                   'archive',         count(*) filter (where kind = 'finish' and puzzle_date <> played_on),
                   'shares',          count(*) filter (where kind = 'share'),
                   'challenges_sent', count(*) filter (where kind = 'share' and challenge)
                 ) as day
            from plays
           where played_on >= since
           group by played_on
        ) d
    ), '[]'::jsonb),

    'games', coalesce((
      select jsonb_object_agg(game_slug, n)
        from (
          select game_slug, count(*) as n
            from plays
           where played_on >= since and kind = 'finish'
           group by game_slug
        ) g
    ), '{}'::jsonb),

    -- Where new visits came from, by the device's first finish of each day.
    'referrers', coalesce((
      select jsonb_agg(jsonb_build_object('host', referrer, 'players', n) order by n desc)
        from (
          select referrer, count(*) as n
            from plays
           where played_on >= since and kind = 'finish' and first_today and referrer is not null
           group by referrer
           order by n desc
           limit 10
        ) r
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function get_play_counts(int) from public;
grant execute on function get_play_counts(int) to authenticated;
