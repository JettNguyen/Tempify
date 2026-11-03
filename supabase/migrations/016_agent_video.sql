-- The daily chart fact is a Reel now, so the bot's bucket takes its video
-- too: an MP4 of about 13 seconds, well under the new 50 MB limit. Who can
-- read it is unchanged (015): only the admin, and the bot's service role.

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'video/mp4'],
    file_size_limit = 52428800
where id = 'agent';
