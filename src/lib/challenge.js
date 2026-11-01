import { ROUND_MAX } from './points.js'

// Challenge links: a finished five-song day can be shared as a link to the
// same day that carries the sharer's points song by song. A friend who opens
// it plays the same songs with the sharer's running score beside theirs, and
// sees both side by side at the end. Nothing is stored: the link is the
// challenge.
//
//   /game/hit-or-miss?date=2026-11-01&vs=850.600.1000.0.420&by=sam

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

/** The query string that turns a game link into a challenge. */
export function challengeQuery({ date, points, name }) {
  const params = new URLSearchParams({ date, vs: points.map(p => Math.round(p)).join('.') })
  if (name) params.set('by', name)
  return params.toString()
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
  const name = (params.get('by') || '').trim().slice(0, MAX_NAME) || null
  return { name, points, total: points.reduce((a, b) => a + b, 0) }
}

/** Who sent it, the way the screen says it. */
export function rivalName(challenge) {
  return challenge?.name || 'Your friend'
}
