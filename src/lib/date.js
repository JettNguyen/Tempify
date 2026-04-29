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
