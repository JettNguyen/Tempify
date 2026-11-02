import { ROUND_MAX, fmtPoints } from './points.js'

// Every share links to the game and day it was played on. Today's game, or
// an answer to a friend's challenge, also carries the sharer's result: a
// friend who opens it plays the same puzzle with that result beside theirs,
// and sees both side by side at the end. Nothing is stored: the link is the
// challenge.
//
//   /game/hit-or-miss?date=2026-11-01&vs=850.600.1000.0.420&by=sam
//   /game/one-bar?date=2026-11-01&vs=3&by=sam      guesses taken, 0 for a miss
//   /game/era?date=2026-10-20&s=share              a past day, no challenge

// The public site. Inside the app the page's own address is
// capacitor://localhost, which nobody else can open.
export const PUBLIC_ORIGIN = 'https://tempify.me'

// Long enough for any username, short enough that a doctored link can't fill
// the screen.
const MAX_NAME = 24

/** An address on the site that works for anyone it's sent to. */
export function siteUrl(path = '', { native = false, origin = PUBLIC_ORIGIN, base = '/' } = {}) {
  return (native ? PUBLIC_ORIGIN : origin) + base.replace(/\/$/, '') + path
}

/**
 * The query string for a shared game link. With `points` (a points game,
 * round by round) or `guesses` (One Bar) it's a challenge; without either it
 * only opens the same day, marked s=share so a visit from it can be told
 * apart from one that wasn't shared.
 */
export function shareQuery({ date, points, guesses, name }) {
  const params = new URLSearchParams({ date })
  const vs = points ? points.map(p => Math.round(p)).join('.') : guesses != null ? String(guesses) : null
  if (vs == null) {
    params.set('s', 'share')
    return params.toString()
  }
  params.set('vs', vs)
  if (name) params.set('by', name)
  return params.toString()
}

function readName(params) {
  return (params.get('by') || '').trim().slice(0, MAX_NAME) || null
}

/**
 * The challenge a game link carries, or null. `rounds` is how many scored
 * rounds the day has: a link whose count doesn't match was made for a
 * different puzzle, so it's ignored rather than compared wrongly.
 */
export function readChallenge(params, rounds) {
  const vs = params.get('vs')
  if (!vs) return null
  const points = vs.split('.').map(Number)
  if (points.some(p => !Number.isInteger(p) || p < 0 || p > ROUND_MAX)) return null
  if (rounds != null && points.length !== rounds) return null
  return { name: readName(params), points, total: points.reduce((a, b) => a + b, 0) }
}

/** One Bar's challenge: the guesses the friend took, 0 if they missed it. */
export function readGuessChallenge(params, maxGuesses) {
  const vs = params.get('vs')
  if (!/^\d+$/.test(vs || '')) return null
  const guesses = Number(vs)
  if (guesses > maxGuesses) return null
  return { name: readName(params), guesses }
}

/**
 * Above 0 when `mine` beats `theirs`, both guesses taken with 0 for a miss:
 * getting it at all beats missing it, then fewer guesses win.
 */
export function compareGuesses(mine, theirs) {
  const rank = g => (g > 0 ? g : Infinity)
  if (rank(mine) === rank(theirs)) return 0
  return rank(mine) < rank(theirs) ? 1 : -1
}

/** Who sent it, the way the screen says it. */
export function rivalName(challenge) {
  return challenge?.name || 'Your friend'
}

const guessCount = (n) => `${n} guess${n === 1 ? '' : 'es'}`

/**
 * The line a reply to a challenge ends on, written to the friend who sent
 * it. `total` is this player's points, or `guesses` theirs on One Bar.
 */
export function replyLine(challenge, { total, guesses }) {
  if (challenge.guesses != null) {
    const theirs = challenge.guesses
    const result = compareGuesses(guesses, theirs)
    if (result === 0) return guesses ? `Tied you at ${guessCount(guesses)}` : 'Neither of us got it'
    if (result > 0) return theirs ? `Beat you, ${guessCount(guesses)} to your ${theirs}` : "Beat you, I got it and you didn't"
    return guesses ? `You won, ${guessCount(theirs)} to my ${guesses}` : 'You won this one'
  }
  const diff = Math.round(total || 0) - challenge.total
  if (diff > 0) return `Beat your ${fmtPoints(challenge.total)} by ${fmtPoints(diff)}`
  if (diff < 0) return `You won by ${fmtPoints(-diff)}`
  return `Tied you at ${fmtPoints(challenge.total)}`
}
