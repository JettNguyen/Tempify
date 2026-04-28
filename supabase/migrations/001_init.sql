create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text,
  is_subscribed boolean default false,
  subscription_end timestamp,
  created_at timestamp default now()
);

create table if not exists puzzles (
  id uuid primary key default gen_random_uuid(),
  game_slug text not null,
  scheduled_date date not null,
  audio_url text,
  answer text,
  metadata jsonb,
  created_at timestamp default now()
);

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  game_slug text,
  date_played date,
  attempts int,
  completed boolean,
  created_at timestamp default now()
);

create table if not exists streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  game_slug text,
  current_streak int default 0,
  longest_streak int default 0,
  last_played_date date
);

alter table users enable row level security;
alter table puzzles enable row level security;
alter table scores enable row level security;
alter table streaks enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'puzzles' and policyname = 'Puzzles are publicly readable') then
    create policy "Puzzles are publicly readable" on puzzles for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'users' and policyname = 'Users can read own profile') then
    create policy "Users can read own profile" on users for select using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'users' and policyname = 'Users can update own profile') then
    create policy "Users can update own profile" on users for update using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'users' and policyname = 'Users can insert own profile') then
    create policy "Users can insert own profile" on users for insert with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'scores' and policyname = 'Users can read own scores') then
    create policy "Users can read own scores" on scores for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'scores' and policyname = 'Users can insert own scores') then
    create policy "Users can insert own scores" on scores for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'streaks' and policyname = 'Users can read own streaks') then
    create policy "Users can read own streaks" on streaks for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'streaks' and policyname = 'Users can upsert own streaks') then
    create policy "Users can upsert own streaks" on streaks for all using (auth.uid() = user_id);
  end if;
end $$;

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
