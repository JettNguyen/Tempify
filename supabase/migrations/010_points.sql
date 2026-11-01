-- Points, for the games that score by how close you got rather than right or
-- wrong (Hit or Miss's peak dial, Era's timeline, Tap the Tempo). Null for
-- every score set before, and for every pick-one game still.

alter table scores add column if not exists points int;

-- The same totals as 009, plus how the points spread. Bucketed by the hundred
-- for the same reason times are bucketed: a raw score could be tied back to
-- one person on a quiet day.

create or replace function get_puzzle_stats(p_game_slug text, p_date date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with played as (
    select attempts, completed, time_seconds, points
      from scores
     where game_slug = p_game_slug
       and date_played = p_date
  ),
  solved as (
    select * from played where completed
  ),
  scored as (
    select * from played where points is not null
  )
  select jsonb_build_object(
    'total',  (select count(*) from played),
    'solved', (select count(*) from solved),

    -- One Bar unlocks a fixed ladder of clip lengths, one rung per attempt, so
    -- the attempt count is really "how much audio did they need".
    'attempts', coalesce((
      select jsonb_object_agg(attempts::text, n)
        from (
          select attempts, count(*) as n
            from solved
           where attempts is not null
           group by attempts
        ) a
    ), '{}'::jsonb),

    -- The pick-one games vary only in time. Bucketed here rather than returned
    -- raw, so a solve time can never be tied back to one person.
    'times', coalesce((
      select jsonb_object_agg(bucket::text, n)
        from (
          select case
                   when time_seconds <  5 then 0
                   when time_seconds < 10 then 1
                   when time_seconds < 20 then 2
                   when time_seconds < 30 then 3
                   when time_seconds < 60 then 4
                   else 5
                 end as bucket,
                 count(*) as n
            from solved
           where time_seconds is not null
           group by 1
        ) t
    ), '{}'::jsonb),

    -- Every scored play, won or not: in a points game a low score is still a
    -- place on the spread. Keyed by the hundred (3,420 lands in "34").
    'points', coalesce((
      select jsonb_object_agg(bucket::text, n)
        from (
          select points / 100 as bucket, count(*) as n
            from scored
           group by 1
        ) p
    ), '{}'::jsonb),
    'points_avg', (select round(avg(points)) from scored)
  );
$$;

revoke all on function get_puzzle_stats(text, date) from public;
grant execute on function get_puzzle_stats(text, date) to anon, authenticated;
