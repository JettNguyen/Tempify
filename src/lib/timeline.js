import { ROUND_MAX } from './points.js'

// Era as a timeline: one song starts on the line with its year showing, and
// each song after it goes in a gap, before, between or after the ones placed
// so far. Gaps are numbered from 0 (before the earliest) to n (after the
// latest), n being how many songs are on the line.

// One gap out is close: it was a neighbor, not a different era. Half a
// round, so it shows as near rather than wrong.
const ONE_OFF = 500

/** The gaps a song can rightly go in. Two, when it ties a year already placed. */
export function rightGaps(placedYears, year) {
  const lo = placedYears.filter(y => y < year).length
  const hi = placedYears.filter(y => y <= year).length
  return [lo, hi]
}

export function gapPoints(gap, [lo, hi]) {
  const off = gap < lo ? lo - gap : gap > hi ? gap - hi : 0
  if (off === 0) return ROUND_MAX
  return off === 1 ? ONE_OFF : 0
}

/** What a gap means in words, against the years already on the line. */
export function gapLabel(sortedYears, gap) {
  const n = sortedYears.length
  if (gap === 0) return `Before ${sortedYears[0]}`
  if (gap >= n) return `After ${sortedYears[n - 1]}`
  return `Between ${sortedYears[gap - 1]} and ${sortedYears[gap]}`
}
