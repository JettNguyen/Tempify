# Tempify

<p align="center">
<img src=./public/favicon.svg style=width:150px>
</p>

Five music games, one new track each day.

**[Tempify](https://JettNguyen.github.io/Tempify/)** &nbsp;·&nbsp; Free to play, no account required

---

## The games

**One Bar**: You get a half-second clip. Name the song within up to 6 attempts. Every wrong guess unlocks a second and a half more.

**Drop or Flop**: Did this song chart or disappear without a trace?

**Who Sampled It** — A famous track plays. Pick which song it sampled from four options.

**Era** — No hints, no context. Just the music. Guess the decade.

**The Flip** — Two versions of the same song. Which one came first?

Results reset at midnight. Come back tomorrow.

---

## Accounts

You can play all five games without signing up — completions are saved locally so your progress carries across the session. Creating a free account unlocks streak tracking across all games.

A subscription ($3/mo) opens the full archive so you can play back any day from the beginning.

---

## Development

Built with React + Vite + Tailwind CSS. Data lives in Supabase, payments go through Stripe.

### Local setup

```bash
git clone https://github.com/JettNguyen/Tempify.git
cd Tempify
npm install
cp .env.example .env   # fill in your Supabase + Stripe keys
npm run dev
```

The app runs at `http://localhost:5173/Tempify/`.

### Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/migrations/001_init.sql` in the SQL editor
3. Optionally run `supabase/seed.sql` for sample puzzles dated `2024-01-15`
4. Enable Google OAuth under Authentication → Providers
5. Add your redirect URLs under Authentication → URL Configuration:
   - `https://JettNguyen.github.io/Tempify/`
   - `http://localhost:5173/Tempify/`

### Adding puzzles

Puzzles live in the `puzzles` table. Each row needs a `game_slug`, `scheduled_date`, `audio_url`, `answer`, and a `metadata` JSON object. The shape of `metadata` varies per game — see `supabase/seed.sql` for a working example of each.

### Deploying

Pushes to `main` trigger the GitHub Actions workflow at `.github/workflows/deploy.yml`, which builds the app and deploys `dist/` to the `gh-pages` branch. Add your env vars as repository secrets before the first push.

---

Copyright (c) 2025 Jett Nguyen. All rights reserved.
