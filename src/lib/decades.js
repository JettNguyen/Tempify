// The decades Era asks about, oldest first. Shared rather than written out in
// each place: the game screen, the admin picker and the year lookup all have to
// agree, and a list that appears three times drifts.
export const DECADES = ['50s', '60s', '70s', '80s', '90s', '00s', '10s', '20s']

const FIRST_YEAR = 1950

/** "19" or "20" — the half of the label that says which century. */
export function centuryOf(decade) {
  return Number(decade.slice(0, 2)) >= 50 ? '19' : '20'
}

/** The decade a release year belongs to, or null if it predates the list. */
export function yearToDecade(year) {
  const y = parseInt(year, 10)
  if (!y || y < FIRST_YEAR) return null
  const index = Math.floor((y - FIRST_YEAR) / 10)
  return DECADES[Math.min(index, DECADES.length - 1)]
}
