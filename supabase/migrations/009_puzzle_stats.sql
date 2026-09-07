-- How everyone did on a single puzzle, for the result screen.
--
-- Scores are readable only by their owner, and the leaderboard works around
-- that by filtering to users who opted their visibility to public. That is the
-- wrong population to draw percentages from: it is self-selected, and it
-- undercounts. This function is the one place allowed to look across every
-- score, and it can only ever emit totals, so nobody learns who played.

create or replace function get_puzzle_stats(p_game_slug text, p_date date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with played as (
    select attempts, completed, time_seconds
      from scores
     where game_slug = p_game_slug
       and date_played = p_date
  ),
  solved as (
    select * from played where completed
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

    -- Every other game is a single choice, so time is the only thing that
    -- varies. Bucketed here rather than returned raw, so a solve time can
    -- never be tied back to one person.
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
    ), '{}'::jsonb)
  );
$$;

revoke all on function get_puzzle_stats(text, date) from public;
grant execute on function get_puzzle_stats(text, date) to anon, authenticated;
