-- Settings for the Tempify bot that Jett changes from Admin, in one row.
-- post_at is the time of day, Eastern, the bot puts approved Instagram posts
-- up on their day. Never before their day, whatever the time: a chart fact
-- gives away the day before's puzzle. Only the admin sees or changes it here;
-- the bot reads it with its service role, which skips these policies.

create table if not exists agent_settings (
  id          boolean primary key default true check (id),
  post_at     time not null default '09:00',
  updated_at  timestamptz not null default now()
);

insert into agent_settings (id) values (true) on conflict (id) do nothing;

alter table agent_settings enable row level security;

revoke all on agent_settings from anon;

drop policy if exists "Admin manages the bot's settings" on agent_settings;
create policy "Admin manages the bot's settings"
  on agent_settings for all
  using (is_admin())
  with check (is_admin());
