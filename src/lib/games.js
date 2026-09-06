const ACTIVE_GAMES = [
  { slug: 'one-bar',      name: 'One Bar',      path: '/game/one-bar',      description: 'Name the song from a tiny clip. Wrong guesses unlock more audio.', featured: true },
  { slug: 'hit-or-miss',  name: 'Hit or Miss',  path: '/game/hit-or-miss',  description: 'Did it enter the Hot 100?' },
  { slug: 'era',          name: 'Era',          path: '/game/era',          description: 'Guess which decade the song is from.' },
  { slug: 'cover-or-not', name: 'Cover or Not', path: '/game/cover-or-not', description: 'Is it a cover of an earlier track?' },
]

// Retired games are no longer scheduled and don't appear in the daily lineup,
// but their past puzzles stay playable from the archive and past scores keep
// counting, so nobody loses history they earned.
const RETIRED_GAMES = [
  { slug: 'sampled', name: 'Sampled', path: '/game/sampled', description: 'Hear the sample, find the source.', retiredOn: '2026-09-05' },
]

/** Games in today's lineup. */
export const GAMES = ACTIVE_GAMES

/** Everything that has ever shipped — use for archive, names and past stats. */
export const ALL_GAMES = [...ACTIVE_GAMES, ...RETIRED_GAMES]

export const GAME_SLUGS = ACTIVE_GAMES.map(g => g.slug)

export const ALL_GAME_SLUGS = ALL_GAMES.map(g => g.slug)

export const GAME_BY_SLUG = Object.fromEntries(ALL_GAMES.map(g => [g.slug, g]))

export function getGameName(slug) {
  return GAME_BY_SLUG[slug]?.name ?? slug
}

export function isRetiredGame(slug) {
  return Boolean(GAME_BY_SLUG[slug]?.retiredOn)
}

/**
 * Slugs that were part of the daily lineup on a given date. Stats that ask
 * "did they play everything that day" need the lineup as it stood then, or
 * retiring a game would retroactively hand out perfect days.
 */
export function getGameSlugsForDate(date) {
  return ALL_GAMES
    .filter(g => !g.retiredOn || (date && date < g.retiredOn))
    .map(g => g.slug)
}
