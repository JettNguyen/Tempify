import { describe, it, expect } from 'vitest'
import { dayNumber, fmtDayNumber } from './date.js'

describe('dayNumber', () => {
  it('starts at 1 on the first day', () => {
    expect(dayNumber('2026-04-28')).toBe(1)
  })

  it('counts November 2, 2026 as day 189', () => {
    expect(dayNumber('2026-11-02')).toBe(189)
  })

  it('steps by one across the clock change', () => {
    expect(dayNumber('2026-11-01') + 1).toBe(dayNumber('2026-11-02'))
    expect(dayNumber('2027-03-14') + 1).toBe(dayNumber('2027-03-15'))
  })

  it('has no number before the first day or for a date it cannot read', () => {
    expect(dayNumber('2026-04-27')).toBeNull()
    expect(dayNumber(undefined)).toBeNull()
    expect(dayNumber('soon')).toBeNull()
  })
})

describe('fmtDayNumber', () => {
  it('writes the number with a hash and thousands commas', () => {
    expect(fmtDayNumber('2026-11-02')).toBe('#189')
    expect(fmtDayNumber('2029-01-21')).toBe('#1,000')
  })

  it('writes nothing for a day without a number', () => {
    expect(fmtDayNumber('2026-01-01')).toBe('')
  })
})
