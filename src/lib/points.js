// The games that score by how close you got: Hit or Miss's peak dial, Era's
// timeline, Tap the Tempo, and Cover or Not's second question. A day of one of
// these is a handful of rounds worth up to ROUND_MAX each.

import { roundCount } from './games'

export const ROUND_MAX = 1000

// Tap the Tempo, Hit or Miss and Era are played in rounds, so a day is out of
// 1,000 a song (5,000 for five, 3,000 for three), and how well someone plays is
// how much of that they get. Cover or Not is different: its win is the call
// itself, and the year only adds points.
export const ACCURACY_GAMES = new Set(['tempo', 'hit-or-miss', 'era'])
export const FIVE_SONG_MAX = 5 * ROUND_MAX

/** The most a game's day could score: 1,000 for each of its songs. */
export function dayMax(slug, date) {
  return roundCount(slug, date) * ROUND_MAX
}

/**
 * How much of a round a guess earns, from 1 down to 0, when it's `off` from
 * the answer. Full marks within `fullWithin`; past that, the first misses cost
 * little and the cost climbs, so being close is never punished hard but a
 * wild guess still earns nothing from `zeroAt` on.
 */
export function closeness(off, zeroAt, fullWithin = 0) {
  const x = Math.max(0, off - fullWithin) / (zeroAt - fullWithin)
  return x >= 1 ? 0 : 1 - x ** 1.5
}

/** A day's points as a share of what was on offer, from 0 to 1. */
export function dayAccuracy(points, max = FIVE_SONG_MAX) {
  return Math.min(1, Math.max(0, (points || 0) / max))
}

/** A day of rounds rather than one song: the older puzzles of each game have none. */
export function hasRounds(puzzle) {
  return Array.isArray(puzzle?.metadata?.rounds) && puzzle.metadata.rounds.length > 0
}

// A day counts as a win, for streaks and the profile's win rate, from half
// the points on offer. Below that it still has a place on the leaderboard.
export const WIN_SHARE = 0.5

export function isWin(points, max) {
  return max > 0 && points >= max * WIN_SHARE
}

export function fmtPoints(n) {
  return Math.round(n || 0).toLocaleString('en-US')
}

/** How a round went, for its square on the share card and its color on screen. */
export function roundTier(points, max = ROUND_MAX) {
  const share = max > 0 ? points / max : 0
  if (share >= 0.85) return 'close'
  if (share >= 0.5) return 'near'
  return 'far'
}

const SQUARES = { close: '🟩', near: '🟨', far: '🟥' }

export function shareSquares(roundPoints, max = ROUND_MAX) {
  return roundPoints.map(p => SQUARES[roundTier(p, max)]).join('')
}

// Every locked-in round is written down the moment it's locked, so leaving
// halfway and coming back resumes rather than offering the same song again
// with its answer already seen.
const progressKey = (slug, date) => `tempify_rounds_${slug}_${date}`

export function loadRounds(slug, date) {
  try {
    const saved = JSON.parse(localStorage.getItem(progressKey(slug, date)) || '[]')
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

export function saveRounds(slug, date, rounds) {
  try {
    localStorage.setItem(progressKey(slug, date), JSON.stringify(rounds))
  } catch {
    // Storage full or blocked: the round still plays, it just won't resume.
  }
}
