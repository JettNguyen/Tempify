-- Pictures for the bot's posts, and posts the bot can put up itself.
--
-- The daily chart fact is three pictures. The bot uploads them to the private
-- "agent" bucket (posts/<date>/1.jpg and so on) and lists those paths on the
-- item, so Admin can show them on Jett's phone. Only the admin can read them;
-- the bot uploads with the service role, which skips these policies.
--
-- auto_post marks a post the bot can put up on its own: Instagram, once it
-- has a working token. Jett's "Post it" then sets the item to approved, and
-- the bot posts it within minutes and sets it to posted, with the link.

alter table agent_items
  add column if not exists images text[]
    check (images is null or cardinality(images) between 1 and 10),
  add column if not exists auto_post boolean not null default false;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agent', 'agent', false, 8388608, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

drop policy if exists "Admin sees the bot's pictures" on storage.objects;
create policy "Admin sees the bot's pictures"
  on storage.objects for select
  using (bucket_id = 'agent' and public.is_admin());
