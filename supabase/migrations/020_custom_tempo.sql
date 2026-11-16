-- Tap the Tempo joins the games a Tempify+ player can make (migration 019),
-- 11/15/2026. Three to five songs, like Era and Hit or Miss, each with the
-- tempo a friend taps toward. The app fills the tempo in from Deezer, and the
-- maker can tap along with the clip to set it when Deezer has none or reads a
-- slow song at double time. Every song scores, up to 1,000 each, which
-- save_custom_score already allows for any game but One Bar and Era.

alter table custom_games drop constraint if exists custom_games_game_slug_check;
alter table custom_games
  add constraint custom_games_game_slug_check
  check (game_slug in ('one-bar', 'hit-or-miss', 'era', 'tempo'));

-- Saves a game and returns its id. One Bar is one song; Era, Hit or Miss and
-- Tap the Tempo are three to five. The app reads the error text, so keep these
-- phrases: 'premium only', 'too many today'.
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
  if p_game_slug is null or p_game_slug not in ('one-bar', 'hit-or-miss', 'era', 'tempo') then
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
           'weeks_at_one',   case when p_game_slug = 'hit-or-miss' then (r ->> 'weeks_at_one')::int end,
           'bpm',            case when p_game_slug = 'tempo' then (r ->> 'bpm')::int end
         )) order by i)
    into clean
    from jsonb_array_elements(p_rounds) with ordinality as t(r, i);

  -- Every clip is an Apple preview, the same kind the daily games play: they
  -- don't expire, and nothing else can be slipped in as a "clip". A tempo is
  -- one a person can tap: the app holds a maker to the same 40 to 240.
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
        or (p_game_slug = 'tempo'
            and coalesce((e ->> 'bpm')::int, 0) not between 40 and 240)
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
