alter table users add column if not exists autoplay_audio boolean not null default true;
alter table users add column if not exists competitive_mode boolean not null default true;
