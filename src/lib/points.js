// Every game scores in points, up to 1,000 a song: Hit or Miss's peak
// dial, Era's timeline and Tap the Tempo a song at a time, Cover or Not's call
// and its year, and One Bar by how few guesses it took. A day's total is the
// sum of its games.

import { roundCount } from './games'

export const ROUND_MAX = 1000

// Tap the Tempo, Hit or Miss and Era are played in rounds, so a day is out of
// 1,000 a song (5,000 for five, 3,000 for three), and how well someone plays is
// how much of that they get. Cover or Not is different: its win is the call
// itself, and the year only adds points.
export const ACCURACY_GAMES = new Set(['tempo', 'hit-or-miss', 'era'])
export const FIVE_SONG_MAX = 5 * ROUND_MAX

// Era's first song starts on the line with its year showing, so it scores
// nothing: a five-song day is out of 4,000.
const scoredSongs = (slug, songs) => (slug === 'era' ? songs - 1 : songs)

/** The most a game's day could score: 1,000 for each song it scores. */
export function dayMax(slug, date) {
  return scoredSongs(slug, roundCount(slug, date)) * ROUND_MAX
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

/**
 * Cover or Not asks a second question after a cover: when did the original
 * come out? Every cover carries the original's year. An original has no
 * second question, since its year is on the stage already.
 */
export function hasYearQuestion(puzzle) {
  return puzzle?.answer === 'cover' && Number(puzzle?.metadata?.original_year) > 0
}

// One Bar is one song, so it's worth up to 1,000 like a song anywhere else.
// Each guess, a skip included, opens more of the clip and costs 150, so
// getting it on the last one is still worth 250. A miss is 0. Jett picked
// this gentler ladder over 200 a guess on 11/19/2026.
export const ONE_BAR_POINTS = [1000, 850, 700, 550, 400, 250]

/** One Bar's points for the guesses it took, 0 for a miss. */
export function oneBarPoints(guesses) {
  if (!(guesses > 0)) return 0
  return ONE_BAR_POINTS[Math.min(guesses, ONE_BAR_POINTS.length) - 1]
}

/**
 * A finished play's points, in any game. A play saved without points gets
 * them from what it does have: One Bar's guesses (its plays before
 * 11/19/2026, and from iPhone builds made before then), or on the old
 * one-song days, a right call worth a song.
 */
export function playPoints(slug, play) {
  if (!play) return 0
  if (play.points != null) return play.points
  if (slug === 'one-bar') return play.completed ? oneBarPoints(play.attempts) : 0
  return play.completed ? ROUND_MAX : 0
}

/**
 * The most one game's day could score, from its puzzle when it's at hand:
 * 1,000 a scored song, and on Cover or Not 1,000 for the call plus 1,000
 * more for a cover's year.
 */
export function gameMax(slug, date, puzzle) {
  if (slug === 'one-bar') return ROUND_MAX
  if (slug === 'cover-or-not') return hasYearQuestion(puzzle) ? 2 * ROUND_MAX : ROUND_MAX
  if (hasRounds(puzzle)) return scoredSongs(slug, puzzle.metadata.rounds.length) * ROUND_MAX
  if (puzzle) return ROUND_MAX
  return ACCURACY_GAMES.has(slug) ? dayMax(slug, date) : ROUND_MAX
}

/**
 * The most one saved play could have scored, to measure it against. A play
 * saved without points was scored right or wrong, or by One Bar's guesses,
 * out of 1,000; that's every play from before 11/1/2026, when Cover or Not's
 * year question and the days of rounds came in. Cover or Not needs its
 * puzzle to know a cover's 2,000; without it, it's taken as 1,000.
 */
export function playMax(slug, play, puzzle) {
  const top = play?.points == null ? ROUND_MAX : gameMax(slug, play.date_played, puzzle)
  return Math.max(playPoints(slug, play), top)
}

/**
 * How a day is going across its games: the points so far, and the most the
 * games played so far could have given. Only played games count toward
 * `max`, so it never gives away a game still to play: a Cover or Not worth
 * 2,000 is a cover.
 *
 * `plays` maps a slug to its play ({ attempts, completed, points }), and
 * `puzzles` a slug to its puzzle.
 */
export function dayTally(slugs, plays, puzzles = {}, date) {
  let points = 0
  let max = 0
  let played = 0
  for (const slug of slugs) {
    const play = plays[slug]
    if (!play) continue
    const got = playPoints(slug, play)
    played += 1
    points += got
    // A play can't score past its game's top, so a puzzle that didn't load
    // never leaves the total over the line under it.
    max += Math.max(got, gameMax(slug, date, puzzles[slug]))
  }
  return { points, max, played }
}

/**
 * A leaderboard's order: most points first, then, in a game played against
 * the clock, the faster play. Plays that tie on both share a place.
 */
export function rankByPoints(entries, { timed = false } = {}) {
  const time = (e) => (timed && e.timeSeconds != null ? e.timeSeconds : Infinity)
  const sorted = [...entries].sort((a, b) => b.points - a.points || time(a) - time(b))
  let place = 0
  return sorted.map((e, i) => {
    const prev = sorted[i - 1]
    if (!prev || prev.points !== e.points || time(prev) !== time(e)) place = i + 1
    return { ...e, place }
  })
}

/**
 * A board with the player's own play on it. The result, and the board in it,
 * opens while the score is still saving, so the server may not have it yet;
 * one it does have is left as it is.
 */
export function withOwnPlay(entries, own, { timed = false } = {}) {
  if (!own || entries.some(e => e.userId === own.userId)) return entries
  return rankByPoints([...entries, own], { timed })
}

// A day of rounds counts as a win, for streaks and the speed record, from
// half the points on offer. Below that it still has a place on the leaderboard.
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
