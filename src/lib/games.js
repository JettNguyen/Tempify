import { todayEST } from './date'

// A game with `addedOn` joins the lineup on that day. Until it has one
// (null) it's built and schedulable in Admin, and playable by its link, but
// nowhere a player would find it.
const ACTIVE_GAMES = [
  { slug: 'one-bar',      name: 'One Bar',      path: '/game/one-bar',      description: 'Name the song from a tiny clip. Wrong guesses unlock more audio.', featured: true },
  { slug: 'hit-or-miss',  name: 'Hit or Miss',  path: '/game/hit-or-miss',  description: 'How high did each song chart on the Hot 100?' },
  { slug: 'era',          name: 'Era',          path: '/game/era',          description: 'Put five songs in order, oldest to newest.' },
  { slug: 'cover-or-not', name: 'Cover or Not', path: '/game/cover-or-not', description: 'Is it a cover of an earlier track?' },
  { slug: 'tempo',        name: 'Tap the Tempo', path: '/game/tempo',       description: 'Tap the beat of a famous song from memory.', addedOn: '2026-11-02' },
]

function launchedBy(game, date) {
  return game.addedOn === undefined || (game.addedOn != null && date >= game.addedOn)
}

// Retired games are no longer scheduled and don't appear in the daily lineup,
// but their past puzzles stay playable from the archive and past scores keep
// counting, so nobody loses history they earned.
const RETIRED_GAMES = [
  { slug: 'sampled', name: 'Sampled', path: '/game/sampled', description: 'Hear the sample, find the source.', retiredOn: '2026-06-16' },
]

/** Games in today's lineup. */
export const GAMES = ACTIVE_GAMES.filter(g => launchedBy(g, todayEST()))

/** Everything that has ever shipped: use for archive, names and past stats. */
export const ALL_GAMES = [...GAMES, ...RETIRED_GAMES]

/** Every game Admin can schedule, launched or not. */
export const SCHEDULABLE_GAMES = ACTIVE_GAMES

export const GAME_SLUGS = GAMES.map(g => g.slug)

export const ALL_GAME_SLUGS = ALL_GAMES.map(g => g.slug)

export const GAME_BY_SLUG = Object.fromEntries([...ACTIVE_GAMES, ...RETIRED_GAMES].map(g => [g.slug, g]))

export function getGameName(slug) {
  return GAME_BY_SLUG[slug]?.name ?? slug
}

// The games played against a clock. One Bar counts guesses and Tap the Tempo
// counts how close the beat was, so neither has one, and neither is ever
// shown or ranked by time.
const UNTIMED = new Set(['one-bar', 'tempo'])

export function isTimedGame(slug) {
  return !UNTIMED.has(slug)
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
  return [...ACTIVE_GAMES, ...RETIRED_GAMES]
    .filter(g => !g.retiredOn || (date && date < g.retiredOn))
    .filter(g => !date || launchedBy(g, date))
    .map(g => g.slug)
}

// Songs a day, for the games played in rounds. Hit or Miss and Tap the Tempo
// went from five to three on 11/17/2026: the Hot 100 only has so many songs
// that fit them, and three keeps a day quick. Era stays at five. Without a
// date, it's the count for a day written now.
export const THREE_SONGS_FROM = '2026-11-17'
const THREE_SONG_GAMES = new Set(['hit-or-miss', 'tempo'])

export function roundCount(slug, date) {
  return THREE_SONG_GAMES.has(slug) && !(date && date < THREE_SONGS_FROM) ? 3 : 5
}

/**
 * Where the button under a finished game goes: the next game in that day's
 * lineup, or back to the list after the last one. Taken from the lineup so a
 * new game joins the chain the day it launches; Cover or Not kept ending at
 * "Back to games" after Tap the Tempo came after it.
 */
export function nextGameAfter(slug, date) {
  const lineup = ACTIVE_GAMES.filter(g => launchedBy(g, date))
  const at = lineup.findIndex(g => g.slug === slug)
  const next = at >= 0 ? lineup[at + 1] : null
  return next ? { path: next.path, label: next.name } : { path: '/', label: 'Back to games' }
}
