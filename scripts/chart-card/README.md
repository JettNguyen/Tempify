# Tempify's daily chart fact

One Instagram post a day about one song from yesterday's Hit or Miss. It goes out as a Reel of about 20 seconds with an A to D poll, a voice reading it, and the song itself playing under it.

1. **The question.** The song's name lands word by word as the voice says it, over the game's dial dancing like an equalizer. Then "Where did it peak on the Hot 100?" lands the same way. Then the four letters pop in as the voice says "A, B, C, or D?": A Top 10, B #11 to #40, C #41 to #100, D Never charted. The same four are the post's poll.
2. **The countdown, the song's moment.** "Vote in the poll. Answer in 5, 4, 3, 2, 1", a number a second. The voice stops and only a soft tick marks each number, so the song carries it while the dial dances.
3. **The answer.** A swipe up, then a needle swings across the dial with the number running beside it, and settles on the peak with a hit, a flash and a ring. Then the record's cover, how long it charted, and the artist's biggest hit when that did better.
4. **Today's game.** Another swipe: "That was one of yesterday's songs," tempify.me, and "Send this to someone who'd have said A" (the letter furthest from the answer). The voice says "Play today's at tempify dot me."

How it's built to hold people:
- **The hook:** the song's name is on screen and spoken from the first frame.
- **Never still:** something lands every half second or so, the camera punches in on each one, and there's always sound: the voice, the effects, or the song on its own during the countdown.
- **The answer waits:** the poll is one tap, and the Reel holds the answer back until they've had a guess.

It's built to stay clean while doing it: one font, the app's own colors and sounds, and no claims.

Three pictures for a picture post are made too, for when a Reel can't go up.

The Tempify bot makes one every day, a week ahead, from its own copy of this repo. Jett taps "Approve to post" on Admin's Tempify bot page, and the bot puts it up on its day at the posting time he sets there.

## Setting up a Mac for it, once

- **Google Chrome**, in Applications.
- **ffmpeg:** `brew install ffmpeg`
- **The script's own Python packages**, kept apart from the Mac's other Python:

  ```
  python3 -m venv ~/.venvs/tempify-chart-card && ~/.venvs/tempify-chart-card/bin/pip install -r scripts/chart-card/requirements.txt
  ```

- **The voice** is Kokoro, which runs on the Mac itself: free, no account, no key. The first run fetches its two files (about 350 MB) from the kokoro-onnx GitHub releases into `~/.cache/tempify-chart-card/`. It checks them against fixed fingerprints and keeps them for every run after.

## Making a day's post

1. **Update the repo copy** with `git pull`. That brings in the latest template and the Hot 100 index (`src/assets/hot-100-songs.json`).
2. **Pick the song.** Read the Hit or Miss of the day before the post's day (Eastern): the `puzzles` row with `game_slug` `hit-or-miss` and that `scheduled_date`. Its songs are in `metadata.rounds` (five through 11/16/2026, three from 11/17), each with `title`, `artist`, `year` and `peak` (0 means it never charted). Pick the one most people would guess wrong:
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
   | `song`, `artist` | Always. As people know them; this is what the post shows. |
   | `never_charted` | `true` when the round's `peak` is 0. The script checks the index agrees. |
   | `year` | With `never_charted`: the round's `year`, shown as "Released in 1971" and said as "it came out in seventy-one". |
   | `index_title` | Only when the index spells the title differently (the script tells you). |
   | `say_song`, `say_artist` | Only when the voice says a name wrong: the name spelled the way it's said ("Pink" for P!nk). Keep the same number of words, so the words still land as they're said. |
   | `poll` | `false` only if Instagram turns the poll down. The question then says "Pick a letter" and "Comment your letter". |
   | `art` | `false` to leave the cover out. |
   | `art_release_group` | A MusicBrainz release group id, when the cover it found is the wrong record. |

4. **Run** `python3 scripts/chart-card/render-chart-card.py <the day's folder>`. It moves itself into its own Python, and takes about half a minute.
   - It looks the song up in the index, so the peak, weeks and dates are never typed by hand.
   - It takes the cover from the Cover Art Archive: the song's single first, else the artist's own studio album. Never a greatest-hits, live or various-artists record.
   - It writes `reel.mp4`, `reel-cover.jpg`, `1.jpg` to `3.jpg`, `art.jpg` (when it found a cover), `caption.txt`, `poll.json` and `facts.json`. `facts.json` lists every line the voice said, under `said`.
   - If it stops, read what it says and fix `post.json`. When it can't find the song, it lists the artist's titles from the index. Never get past a stop by changing the facts; pick another song instead.
5. **Look at it and listen to it.**
   - Watch the whole Reel with the sound on: nothing cut off, every word inside the picture.
   - The voice says the song and the artist right. If not, use `say_song` or `say_artist`.
   - The cover is the song's own record.
   - Check the three pictures too.
6. **Upload** to Tempify's Supabase storage, bucket `agent`, under `posts/<date>/`: `reel.mp4`, `reel-cover.jpg` and `1.jpg` to `3.jpg`. The bucket is private: only the admin and the service role can read it.
7. **Hand it to Jett** as an `agent_items` row:
   - `kind` `post`, `place` `Instagram`, `due_on` the day
   - `title` "Chart fact for Tue 11/24"
   - `body`: exactly what's in `caption.txt`
   - `images`: `posts/<date>/reel.mp4`, then the three pictures, in order. Admin plays the Reel and shows the pictures.
   - `auto_post`: `true` when the bot can post to Instagram itself

## Posting it

Jett's "Approve to post" sets the row to `approved`. The bot puts it up on its day at the posting time, never before its day, since it gives away the day before's puzzle. It never posts a row twice.

The posting time is Jett's to set in Admin, for every post: the one row of `agent_settings`, `post_at`, a time of day in Eastern (migration 017). Read it at every check; if the table isn't there yet, use 9:00. A post approved after its time goes up at the next check.

With signed links that last an hour:

- **The Reel:** `media_type` `REELS`, `video_url` the Reel, `cover_url` `reel-cover.jpg`, `share_to_feed` `true`, the caption, and `poll_attachment` from `poll.json`.
- **The music:** search Instagram's Audio API for the post's own song. Attach it with `audio_configuration` only when the title and artist match: `video_volume` 100 (the voice and the effects) and `audio_volume` 75 (the song). With no match, post without music; never a different song.
  - The API sets each level once for the whole Reel. It has no ducking like the Edits app's, and no choice of where in the song it starts. So the voice is made to cut through the song instead, and the countdown leaves the song on its own.
  - 75 is Jett's pick, after trying a draft in the Instagram app on November 3, 2026.
- **If Instagram refuses:** if the poll is refused, post without it and log that. If the Reel can't go up at all, post the three pictures as one picture post instead.
- **Afterwards:** set the row to `posted` with the post's link, and log it.

The caption ends by saying the voice is made with AI. Meta asks for that on realistic made-up voices, and it's honest.

## What a post never does

- Use album art from anywhere but the Cover Art Archive. Tempify's own art comes from Apple and Deezer, and their terms don't allow promotion like this. The covers belong to their labels either way, so they stay small and only on the answer.
- Play a song other than the post's own, or put any music in the video itself. The song only ever comes from Instagram's library.
- Say anything about today's puzzles.
- Mention Premium, or claim player numbers Tempify doesn't have.

## Changing it

Almost all of it is `tempify-chart-card.html`:
- every word on screen is in `COPY`, and every line the voice says is in `VOICE`
- every color is in `:root`
- the dial's four stretches are in `ZONES`
- when things happen is `schedule()`, which times the Reel around how long each voice line takes
- how things move is `seek()`, and the sounds are `cues()`. Most are the app's own (`public/sounds`). The whoosh, glide and hit are made in `render-chart-card.py`.

The voice and its speed, the caption, and the frame rate are at the top of `render-chart-card.py`. The four letters' wording appears in both files and has to match.

After a change, render the example and watch it:

```
python3 scripts/chart-card/render-chart-card.py scripts/chart-card/posts/example
```

Its output isn't kept in git.

To see it without the script, open the HTML in Chrome:
- `?slide=2` or `?slide=3` shows the other pictures
- `?format=reel&play` runs the Reel (no sound, and the timing is guessed)
- `?format=reel&t=9.5` shows one moment of it
- `?guides` shows what Instagram keeps clear

Started November 2, 2026. The Reel moved and talked from November 3.
