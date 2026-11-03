-- A line from the bot on one of its items, shown on the item's card in Admin.
-- First use: whether a chart fact's Reel gets its song. Instagram's music
-- library for apps rarely has a Hot 100 song, so the card says before Jett
-- approves it whether the Reel goes up with the song or without music. The
-- bot writes it with its service role; only the admin reads it (014).

alter table agent_items
  add column if not exists bot_note text check (char_length(bot_note) <= 500);
