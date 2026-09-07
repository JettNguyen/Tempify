/** Current date in America/New_York time, formatted as YYYY-MM-DD */
export function todayEST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

/** Yesterday's date in America/New_York time, formatted as YYYY-MM-DD */
export function yesterdayEST() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

/** Format seconds as m:ss or s.ts. Returns null for null/undefined input. */
export function fmtTime(s) {
  if (s == null) return null
  const mins = Math.floor(s / 60)
  const secs = Math.floor(s % 60)
  const tenths = Math.floor((s % 1) * 10)
  return mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}.${tenths}s`
}

/** Read a plain YYYY-MM-DD at midday, so it never slips a day west of UTC. */
function parseDay(dateStr) {
  if (!dateStr) return null
  const d = new Date(`${dateStr}T12:00:00`)
  return isNaN(d.getTime()) ? null : d
}

/** "Sat Sep 5", a puzzle's date at a glance. */
export function fmtDayShort(dateStr) {
  const d = parseDay(dateStr)
  if (!d) return ''
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' })
  return `${weekday} ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

/** "Jun 15, 2026". Carries the year, for dates read long after the fact. */
export function fmtMonthDayYear(dateStr) {
  const d = parseDay(dateStr)
  if (!d) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
