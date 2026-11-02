# Tempify

<p align="center">
<img src=./public/favicon.svg style=width:150px>
</p>

**Five daily music games. One app for people who know their songs.**

<p align="left">
  <a href="https://apps.apple.com/us/app/tempify-me/id6765572192?ppid=f2aa16bb-7d62-49df-bafe-8c35f58c63ad">
    <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" height="48" />
  </a>
</p>

or [Play on the web](https://tempify.me)


---

## Overview

Tempify is a daily music trivia app with five game modes, fresh challenges every day, and optional accounts for streaks, archives, and genre-based play.

- New puzzles every day
- Free to play
- No account required to get started
- Available on the App Store and the web

## App Store

Tempify is now live on the App Store:

**[Tempify Me on the App Store](https://apps.apple.com/us/app/tempify-me/id6765572192?ppid=26675011-0f5b-40a0-be60-8efcc0f6c4a1)**

## Game Modes

### One Bar

Name the song from a half-second clip in up to 6 attempts. Each wrong guess reveals a little more of the track.

### Hit or Miss

Five songs a day. Drag a dial to where each one peaked on the Billboard Hot 100, or past #100 if it
never charted.

### Era

Five songs a day on one timeline. The first song shows its year; put the other four in order,
oldest to newest.

### Cover or Not

Figure out whether the track is the original version or a cover. When it's a cover, a bonus
question asks what year the original came out.

### Tap the Tempo

New on November 2, 2026. See a famous song's title and artist, tap its beat from memory, then hear
the clip and see how close you were. Five songs a day.

### Sampled (retired)

Pick which song was sampled from four choices. Sampled left the daily lineup on
June 16, 2026. Its puzzles are still playable from the archive and past scores
still count.

Daily results reset at midnight EST.

### Points and challenges

Hit or Miss, Era and Tap the Tempo score each song up to 1,000 points, more the closer you get, and
Cover or Not's year question scores the same way. Puzzles get harder through the week, easiest on
Monday and hardest on Sunday.

When you finish a day, share it as a challenge link. A friend who opens it plays the same songs and
sees who won, song by song. Nothing is stored: the link carries the whole challenge.

## Accounts and Subscription

You can play all five games without signing up. Game completions are saved locally so progress carries through your session.

Creating a free account unlocks streak tracking across all games.

Tempify Plus unlocks:

- The full archive, going back to day one
- Browsing by genre
- Recommendations based on what you play

It costs $3 a month, $25 a year, or $100 once for lifetime access.

## Tech Stack

Tempify is built with React, Vite, and Tailwind CSS.

- Backend and data: Supabase
- Payments: Stripe on the web, RevenueCat for in-app purchases on iOS
- iOS app packaging: Capacitor

## Development

Install dependencies and start the app locally:

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## License

Copyright (c) 2026 Jett Nguyen. All rights reserved.
