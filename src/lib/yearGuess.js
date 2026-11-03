import { ROUND_MAX, closeness } from './points.js'

// Cover or Not's second question: once the call is in, when did the original
// come out? A year or two out is worth nearly all of it; a decade out is worth
// nothing.

const ZERO_AT = 10

export function yearPoints(guess, actual) {
  return Math.round(ROUND_MAX * closeness(Math.abs(guess - actual), ZERO_AT))
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
