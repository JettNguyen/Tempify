import { ROUND_MAX } from './points.js'

// Cover or Not's second question: once the call is in, when did the original
// come out? Close is worth most of it; a dozen years out is worth nothing.

const ZERO_AT = 12

export function yearPoints(guess, actual) {
  const off = Math.abs(guess - actual)
  return Math.round(ROUND_MAX * Math.max(0, 1 - off / ZERO_AT))
}

/**
 * The dial's range. It ends at the cover's own year, since the original came
 * first, and starts at 1940, or at 1900 for the few standards older than that.
 */
export function yearRange(originalYear, coverYear) {
  const max = Math.max(originalYear, coverYear || new Date().getFullYear())
  const min = originalYear < 1940 ? 1900 : 1940
  return [min, max]
}
