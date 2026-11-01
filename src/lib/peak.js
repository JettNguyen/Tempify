import { ROUND_MAX } from './points.js'

// Hit or Miss as a dial: how high did it get on the Hot 100, or did it never
// make it? The dial runs from #1 at the left to #100, then a "never charted"
// zone at the far end.
//
// The top of the chart gets more room than the bottom, on a square-root curve:
// #1 against #5 is a real difference, #60 against #65 hardly is, and the dial
// spends its width the same way. Scoring reads distance off the same curve,
// so being four places out near the top costs more than near the bottom.

export const NEVER = 0          // a peak of 0 means it never charted
export const NEVER_FROM = 0.88  // where the never-charted zone starts on the dial
const NEVER_AT = 1              // where a never-charted song sits for scoring

// How far apart two answers can be before a round is worth nothing.
const ZERO_AT = 0.5

/** Where a peak sits on the dial, 0 to 1. */
export function dialAt(peak) {
  if (!peak || peak < 1 || peak > 100) return NEVER_AT
  return Math.sqrt((peak - 1) / 99) * NEVER_FROM
}

/** The peak a dial position stands for. */
export function peakAt(position) {
  if (position > NEVER_FROM) return NEVER
  const p = Math.max(0, position) / NEVER_FROM
  return Math.min(100, Math.max(1, Math.round(1 + 99 * p * p)))
}

export function peakPoints(guess, actual) {
  const off = Math.abs(dialAt(guess) - dialAt(actual))
  return Math.round(ROUND_MAX * Math.max(0, 1 - off / ZERO_AT))
}

export function peakLabel(peak) {
  return peak ? `#${peak}` : 'Never charted'
}

/** A Peak puzzle carries its five songs as rounds; an older Hit or Miss doesn't. */
export function isPeakPuzzle(puzzle) {
  return Array.isArray(puzzle?.metadata?.rounds) && puzzle.metadata.rounds.length > 0
}
