# Tempify's daily chart fact

One Instagram post a day: three pictures and a caption about one song from yesterday's Hit or Miss.

1. **The question.** The song, big, and "Where did it peak on the Hot 100?", with four letters on the game's own dial: A Top 10, B #11 to #40, C #41 to #100, D Never charted. "Comment your letter, then swipe."
2. **The answer.** The peak, lit on the dial, with how long it charted and when. When the artist did better with another song, a box says so: "Queen's biggest: Crazy Little Thing Called Love, #1 for 4 weeks."
3. **Today's game.** "That was one of yesterday's five," tempify.me, and "Send this to someone who'd have said A" (the letter furthest from the answer).

Comments are what make Instagram show a post to more people, and a letter is the easiest comment there is. The third picture gives people a reason to send it on.

The Tempify bot makes one every morning from its own copy of this repo. Jett taps "Post it" on Admin's Tempify bot page, and the bot puts it up.

## Making a day's post

1. **Update the repo copy** with `git pull`. That brings in the latest template and the Hot 100 index (`src/assets/hot-100-songs.json`).
2. **Pick the song.** Read yesterday's Hit or Miss (Eastern): the `puzzles` row with `game_slug` `hit-or-miss` and yesterday's `scheduled_date`. Its five songs are in `metadata.rounds`, each with `title`, `artist`, `year` and `peak` (0 means it never charted). Pick the one most people would guess wrong:
   - a famous song that charted low or never charted, or
   - a song people forget was a big hit.

   Use both kinds. Before picking, read `facts.json` from the last three posts: if the last two answers were the same letter, pick a song with a different answer.
3. **Write `post.json`** in a folder for the day, outside the repo (the script writes its pictures beside it):

   ```json
   {
     "date": "2026-11-24",
     "song": "Don't Stop Me Now",
     "artist": "Queen"
   }
   ```

   | Field | When |
   |---|---|
   | `date` | Always. The day it's posted. Yesterday's puzzle number comes from it. |
   | `song`, `artist` | Always. As people know them; this is what the pictures show. |
   | `never_charted` | `true` when the round's `peak` is 0. The script checks the index agrees. |
   | `year` | With `never_charted`: the round's `year`, shown as "Released in 1971". |
   | `index_title` | Only when the index spells the title differently (the script tells you). |

4. **Run** `python3 scripts/chart-card/render-chart-card.py <the day's folder>`.
   - It looks the song up in the index, so the peak, weeks and dates are never typed by hand.
   - It writes `1.jpg`, `2.jpg`, `3.jpg`, `caption.txt` and `facts.json`.
   - If it stops, read what it says and fix `post.json`. When it can't find the song, it lists the artist's titles from the index. Never get past a stop by changing the facts; pick another song instead.
5. **Look at all three pictures.** Words should sit inside the picture with nothing cut off.
6. **Upload the pictures** to Tempify's Supabase storage, bucket `agent`, as `posts/<date>/1.jpg`, `2.jpg` and `3.jpg`. The bucket is private: only the admin and the service role can read it.
7. **Hand it to Jett** as an `agent_items` row:
   - `kind` `post`, `place` `Instagram`, `due_on` the day
   - `title` "Chart fact for Tue 11/24"
   - `body`: exactly what's in `caption.txt`
   - `images`: the three storage paths, in order
   - `auto_post`: `true` only when the bot can post to Instagram itself

   Admin shows the pictures on Jett's phone.
   - With `auto_post`, his "Post it" sets the row to `approved`. The bot then posts the three pictures as one post through Instagram's API, using short-lived signed links to them, and sets the row to `posted` with the post's link.
   - Without it, he shares the pictures from Admin in Safari and marks the row posted himself.

## What a post never does

- Show album art. Apple's rules for the song clips don't allow it.
- Say anything about today's puzzles.
- Mention Premium, or claim player numbers Tempify doesn't have.

## Changing the look

All of it is `tempify-chart-card.html`:
- every word is in `COPY`, and every color is in `:root`
- the dial's four stretches are in `ZONES`

The caption is `CAPTION` at the top of `render-chart-card.py`. The four letters' wording appears in both files and has to match. After a change, render the example and look at it:

```
python3 scripts/chart-card/render-chart-card.py scripts/chart-card/posts/example
```

Its pictures aren't kept in git.

To see a picture without the script, open the HTML in Chrome:
- `?slide=2` or `?slide=3` shows the other pictures
- `?guides` shows what Instagram's profile grid keeps (it trims the sides to 3 by 4)

Needs Google Chrome and Pillow (`pip3 install pillow`). Started November 2, 2026.
