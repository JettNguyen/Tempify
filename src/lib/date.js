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
