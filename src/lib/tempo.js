import { ROUND_MAX, closeness } from './points.js'

// Tap the Tempo: tap a famous song's beat from memory, then hear how close it
// was. People are better at this than they expect: in Levitin and Cook's
// study most sung-from-memory versions of familiar songs came within 8% of
// the record.

// A pause this long means a fresh start, not a very slow song.
export const RESTART_AFTER_MS = 2500
export const MIN_TAPS = 4
// Only the latest taps count, so a shaky start settles out.
const KEEP = 9

// Tapping is a matter of the hand as well as the memory: even someone who
// knows the beat cold wobbles a little, so taps within 3% count as right on
// it. From there points fall away, and 20% out is worth nothing.
export const FULL_WITHIN = 0.03
const ZERO_AT = 0.2

/** The taps worth keeping after a new one at `now`. */
export function addTap(taps, now) {
  const last = taps[taps.length - 1]
  if (last != null && now - last > RESTART_AFTER_MS) return [now]
  return [...taps, now].slice(-KEEP)
}

/**
 * Beats per minute from tap times in milliseconds, or null under MIN_TAPS.
 * Read off the middle gap rather than the average, so one late or doubled
 * tap doesn't drag it.
 */
export function bpmFromTaps(taps) {
  if (taps.length < MIN_TAPS) return null
  const gaps = taps.slice(1).map((t, i) => t - taps[i]).sort((a, b) => a - b)
  const mid = gaps.length / 2
  const gap = gaps.length % 2 ? gaps[Math.floor(mid)] : (gaps[mid - 1] + gaps[mid]) / 2
  return gap > 0 ? Math.round(60000 / gap) : null
}

const offFrom = (guess, target) => Math.abs(guess - target) / target

// Half and double time count as the same beat: tapping every other kick drum
// isn't wrong.
const SPEEDS = [1, 0.5, 2]

/** Which speed of the song a tap landed nearest: 1, or 0.5 or 2 for half or double. */
function closestSpeed(guess, actual) {
  return SPEEDS.reduce((best, s) => (offFrom(guess, actual * s) < offFrom(guess, actual * best) ? s : best))
}

/** How far off a tapped tempo is, as a share of the speed it landed nearest. */
export function tempoOff(guess, actual) {
  return offFrom(guess, actual * closestSpeed(guess, actual))
}

export function tempoPoints(guess, actual) {
  return Math.round(ROUND_MAX * closeness(tempoOff(guess, actual), ZERO_AT, FULL_WITHIN))
}

/**
 * How a finished round reads on screen. A tap that scored off half or double
 * the song's speed has to say so, since 80 against 170 looks like a wild miss.
 * One that earned nothing is measured against the song itself: half being the
 * nearer miss doesn't make it a half speed tap.
 */
export function readTap(guess, actual, points) {
  const speed = points > 0 ? closestSpeed(guess, actual) : 1
  return { speed, percentOff: Math.round(offFrom(guess, actual * speed) * 100) }
}
