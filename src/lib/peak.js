import { ROUND_MAX, closeness } from './points.js'

// Hit or Miss: how high did it get on the Hot 100, or did it never make it?
// A position runs from 0 at #1 to #100, then a "never charted" zone to 1. The
// chart bar (components/ChartBar.jsx) draws it top to bottom; the names here
// still say dial, which is what it was first.
//
// The top of the chart gets more room than the bottom, on a square-root curve:
// #1 against #5 is a real difference, #60 against #65 hardly is, and the bar
// spends its height the same way. Scoring reads distance off the same curve,
// so being four places out near the top costs more than near the bottom.

export const NEVER = 0          // a peak of 0 means it never charted
export const NEVER_FROM = 0.88  // where the never-charted zone starts on the dial
const NEVER_AT = 1              // where a never-charted song sits for scoring

// How far apart two answers can be before a round is worth nothing. Near
// misses cost little (closeness() eases in), so this is set where a guess
// anywhere on the dial earns about 400 on average, as it did before.
const ZERO_AT = 0.4

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
  return Math.round(ROUND_MAX * closeness(off, ZERO_AT))
}

export function peakLabel(peak) {
  return peak ? `#${peak}` : 'Never charted'
}

/**
 * A peak moved some places along the chart: negative is higher, toward #1.
 * Below #100 is never charted, and moving up from never starts at #100.
 */
export function stepPeak(peak, places) {
  const rank = peak ? peak : 101
  const next = Math.min(101, Math.max(1, rank + places))
  return next === 101 ? NEVER : next
}
