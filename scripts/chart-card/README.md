# Tempify's daily chart fact

One Instagram post a day about one song from yesterday's Hit or Miss. It goes out as a Reel with an A to D poll.

1. **The question.** The song, big, and "Where did it peak on the Hot 100?", with four letters on the game's own dial: A Top 10, B #11 to #40, C #41 to #100, D Never charted. The same four are the post's poll. In the Reel the question counts down, "Answer in 3, 2, 1".
2. **The answer.** The peak, lit on the dial, with how long it charted and when, and the record's cover beside the song. When the artist did better with another song, a box says so: "Queen's biggest: Crazy Little Thing Called Love, #1 for 4 weeks."
3. **Today's game.** "That was one of yesterday's five," tempify.me, and "Send this to someone who'd have said A" (the letter furthest from the answer).

How it's shaped:
- **Poll:** a one-tap poll gets more people answering than asking for comments, and comments still work.
- **Reel:** about 13 seconds made from the same three pictures, with the song itself playing when Instagram's music library has it. Reels reach people who don't follow the account yet.
- **Pictures:** the same three are also made as pictures, for a picture post when a Reel can't go up.

The Tempify bot makes one every day, a week ahead, from its own copy of this repo. Jett taps "Post it" on Admin's Tempify bot page, and the bot puts it up at 9 AM Eastern on its day.

## Making a day's post

1. **Update the repo copy** with `git pull`. That brings in the latest template and the Hot 100 index (`src/assets/hot-100-songs.json`).
2. **Pick the song.** Read the Hit or Miss of the day before the post's day (Eastern): the `puzzles` row with `game_slug` `hit-or-miss` and that `scheduled_date`. Its five songs are in `metadata.rounds`, each with `title`, `artist`, `year` and `peak` (0 means it never charted). Pick the one most people would guess wrong:
   - a famous song that charted low or never charted, or
   - a song people forget was a big hit.

   Use both kinds:
   - Read `facts.json` from the posts around it, and never use the same letter three days running.
   - Don't use the same song or artist twice in a week.
   - Skip a song whose "biggest" box would leave out a bigger hit the act had under another form of its name (Grand Funk Railroad's #1s are credited to "Grand Funk").
3. **Write `post.json`** in a folder for the day, outside the repo (the script writes everything beside it):

   ```json
   {
     "date": "2026-11-24",
     "song": "Don't Stop Me Now",
     "artist": "Queen"
   }
   ```

   | Field | When |
   |---|---|
   | `date` | Always. The day it's posted. The puzzle number comes from it. |
   | `song`, `artist` | Always. As people know them; this is what the pictures show. |
   | `never_charted` | `true` when the round's `peak` is 0. The script checks the index agrees. |
   | `year` | With `never_charted`: the round's `year`, shown as "Released in 1971". |
   | `index_title` | Only when the index spells the title differently (the script tells you). |
   | `poll` | `false` only if Instagram turns the poll down. The question then says "Comment your letter". |
   | `art` | `false` to leave the cover out. |
   | `art_release_group` | A MusicBrainz release group id, when the cover it found is the wrong record. |

4. **Run** `python3 scripts/chart-card/render-chart-card.py <the day's folder>`.
   - It looks the song up in the index, so the peak, weeks and dates are never typed by hand.
   - It takes the cover from the Cover Art Archive: the song's single first, else the artist's own studio album. Never a greatest-hits, live or various-artists record.
   - It writes `reel.mp4`, `reel-cover.jpg`, `1.jpg` to `3.jpg`, `art.jpg` (when it found a cover), `caption.txt`, `poll.json` and `facts.json`.
   - If it stops, read what it says and fix `post.json`. When it can't find the song, it lists the artist's titles from the index. Never get past a stop by changing the facts; pick another song instead.
5. **Look at it.** Check all three pictures and a few frames of the Reel: words inside the picture, nothing cut off. Make sure the cover is the song's own record.
6. **Upload** to Tempify's Supabase storage, bucket `agent`, under `posts/<date>/`: `reel.mp4`, `reel-cover.jpg` and `1.jpg` to `3.jpg`. The bucket is private: only the admin and the service role can read it.
7. **Hand it to Jett** as an `agent_items` row:
   - `kind` `post`, `place` `Instagram`, `due_on` the day
   - `title` "Chart fact for Tue 11/24"
   - `body`: exactly what's in `caption.txt`
   - `images`: `posts/<date>/reel.mp4`, then the three pictures, in order. Admin plays the Reel and shows the pictures.
   - `auto_post`: `true` when the bot can post to Instagram itself

## Posting it

Jett's "Post it" sets the row to `approved`. The bot puts it up at 9 AM Eastern on its day, never before, since it gives away the day before's puzzle. It never posts a row twice. With signed links that last an hour:

- **The Reel:** `media_type` `REELS`, `video_url` the Reel, `cover_url` `reel-cover.jpg`, `share_to_feed` `true`, the caption, and `poll_attachment` from `poll.json`.
- **The music:** search Instagram's Audio API for the post's own song. Attach it with `audio_configuration` only when the title and artist match. With no match, post without music; never a different song.
- **If Instagram refuses:** if the poll is refused, post without it and log that. If the Reel can't go up at all, post the three pictures as one picture post instead.
- **Afterwards:** set the row to `posted` with the post's link, and log it.

## What a post never does

- Use album art from anywhere but the Cover Art Archive. Tempify's own art comes from Apple and Deezer, and their terms don't allow promotion like this. The covers belong to their labels either way, so they stay small and only on the answer.
- Play a song other than the post's own.
- Say anything about today's puzzles.
- Mention Premium, or claim player numbers Tempify doesn't have.

## Changing the look

All of it is `tempify-chart-card.html`:
- every word is in `COPY`, and every color is in `:root`
- the dial's four stretches are in `ZONES`

The caption and the Reel's timing are at the top of `render-chart-card.py`. The four letters' wording appears in both files and has to match. After a change, render the example and look at it:

```
python3 scripts/chart-card/render-chart-card.py scripts/chart-card/posts/example
```

Its output isn't kept in git.

To see a picture without the script, open the HTML in Chrome:
- `?slide=2` or `?slide=3` shows the other pictures
- `?format=reel` shows the Reel's frames, and `&count=3` the countdown
- `?guides` shows what Instagram keeps clear

Needs Google Chrome, Pillow (`pip3 install pillow`) and ffmpeg (`brew install ffmpeg`). Started November 2, 2026.
