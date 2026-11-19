-- Every game ranks by points from 11/19/2026, and a low score still has a
-- place on the board. The rule below only let other players read a win, so
-- a friend's day of rounds under half the points, a One Bar miss or a wrong
-- call in Cover or Not never reached anyone else's board, while your own
-- did. Who shows is still on_leaderboard's say (migration 013): a player
-- whose leaderboard setting is public or followers.

drop policy if exists "Scores readable for leaderboard" on scores;
create policy "Scores readable for leaderboard"
  on scores for select
  using (auth.uid() = user_id or on_leaderboard(user_id));

-- One Bar scores 1,000, 850, 700, 550, 400 or 250 by the guess it was got
-- on, and 0 for a miss: the same ladder as ONE_BAR_POINTS in
-- src/lib/points.js, which has to change with it. iPhone builds made before
-- 11/19/2026 save One Bar without points, so the database works them out
-- from the guesses on every save, whatever a build sends, and the plays
-- already saved get theirs too. Every board, in every build, then sorts
-- One Bar the same way.

create or replace function one_bar_points(p_attempts int, p_completed boolean)
returns int
language sql
immutable
as $$
  select case
           when not coalesce(p_completed, false) or coalesce(p_attempts, 0) < 1 then 0
           else (array[1000, 850, 700, 550, 400, 250])[least(p_attempts, 6)]
         end;
$$;

create or replace function fill_one_bar_points()
returns trigger
language plpgsql
as $$
begin
  if new.game_slug = 'one-bar' then
    new.points := one_bar_points(new.attempts, new.completed);
  end if;
  return new;
end;
$$;

drop trigger if exists fill_one_bar_points on scores;
create trigger fill_one_bar_points
  before insert or update on scores
  for each row execute function fill_one_bar_points();

update scores
   set points = one_bar_points(attempts, completed)
 where game_slug = 'one-bar'
   and points is null;
