alter table puzzles add column if not exists genre text;

-- Index for genre filtering in the Explore page
create index if not exists puzzles_genre_idx on puzzles (genre);
create index if not exists puzzles_date_idx on puzzles (scheduled_date desc);
