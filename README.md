# Tempify

A daily music games suite. Five games, one track each day — figure it out from a clip, guess the decade, decide if it charted, trace the sample, settle the version debate.

Built with React + Vite + Tailwind CSS on the frontend, Supabase for auth and data, and Stripe for subscriptions. Deploys to GitHub Pages automatically on push to `main`.

---

## Local setup

Clone the repo and install dependencies:

```bash
npm install
```

Copy the env file and fill in your keys:

```bash
cp .env.example .env
```

Start the dev server:

```bash
npm run dev
```

The app runs at `http://localhost:5173/Tempify/`.

---

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run the migration in `supabase/migrations/001_init.sql` via the Supabase SQL editor
3. Optionally run `supabase/seed.sql` to load sample puzzle data for `2024-01-15`
4. Enable Google OAuth in Authentication → Providers if you want Google sign-in
5. Copy your project URL and anon key into `.env`

The migration creates four tables (`users`, `puzzles`, `scores`, `streaks`), enables Row Level Security on all of them, and adds a trigger that creates a user profile row automatically when someone signs up.

---

## Adding puzzles

Puzzles live in the `puzzles` table. Each puzzle needs a `game_slug`, a `scheduled_date`, an `audio_url` (iTunes preview URL or any direct audio URL), an `answer`, and a `metadata` JSON blob that varies per game.

**One Bar** — answer is the song title, metadata needs `artist`, `year`, `track_id`.

**Drop or Flop** — answer is the song title, metadata needs `artist`, `year`, `peak_position`, `weeks_at_one`, `verdict` (`"hit"` or `"miss"`), and optionally `hint`.

**Who Sampled It** — answer is the sampled song title, metadata needs `sample_artist`, `sample_year`, `source_song`, `source_artist`, `source_year`, and an `options` array of `{ title, artist }` objects (include the correct answer in the array).

**Era** — answer is the decade string (`"90s"`, `"00s"`, etc.), metadata needs `title`, `artist`, `year`, `decade`.

**The Flip** — answer is `"A"` or `"B"` (whichever version came first), metadata needs `version_a` and `version_b` objects each with `title`, `artist`, `year`, `audio_url`.

---

## GitHub Pages deployment

1. Push the repo to GitHub (the repo should be named `Tempify` to match the `base: '/Tempify/'` in `vite.config.js`)
2. Go to Settings → Pages → Source → select `gh-pages` branch
3. Add your env vars as repository secrets (Settings → Secrets → Actions):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_STRIPE_PUBLISHABLE_KEY`
   - `VITE_STRIPE_PRICE_ID`
   - `VITE_STRIPE_CUSTOMER_PORTAL_URL`

Every push to `main` triggers the GitHub Actions workflow at `.github/workflows/deploy.yml`, which builds the app and deploys `dist/` to the `gh-pages` branch.

If your repo is named differently, update the `base` in `vite.config.js` and the `basename` in `src/App.jsx` to match.

---

## Folder structure

```
Tempify/
├── .github/workflows/deploy.yml   # CI/CD for GitHub Pages
├── public/favicon.svg
├── src/
│   ├── components/                # Shared UI pieces
│   │   ├── Navbar.jsx
│   │   ├── AudioPlayer.jsx        # Custom minimal audio player
│   │   ├── GuessInput.jsx         # iTunes-powered song search
│   │   ├── ResultCard.jsx         # Post-game result display
│   │   ├── ShareButton.jsx        # Clipboard share
│   │   ├── StreakDisplay.jsx
│   │   ├── GameTile.jsx
│   │   └── ArchiveLock.jsx
│   ├── games/                     # The five games
│   │   ├── OneBar.jsx
│   │   ├── DropOrFlop.jsx
│   │   ├── WhoSampledIt.jsx
│   │   ├── Era.jsx
│   │   └── TheFlip.jsx
│   ├── pages/                     # Route-level pages
│   │   ├── Home.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Archive.jsx
│   │   ├── ArchiveDay.jsx
│   │   ├── Login.jsx
│   │   ├── Signup.jsx
│   │   ├── Subscribe.jsx
│   │   └── Success.jsx
│   ├── lib/
│   │   ├── supabase.js            # Supabase client
│   │   ├── puzzles.js             # Puzzle fetching
│   │   ├── scores.js              # Score saving + streaks
│   │   └── itunes.js              # iTunes search API
│   ├── hooks/
│   │   ├── useAuth.js             # Auth state + profile
│   │   └── useCompletion.js       # Today's completion tracking
│   ├── styles/globals.css
│   ├── App.jsx                    # Router
│   └── main.jsx
├── supabase/
│   ├── migrations/001_init.sql
│   └── seed.sql
├── .env.example
├── vite.config.js
├── tailwind.config.js
└── package.json
```
