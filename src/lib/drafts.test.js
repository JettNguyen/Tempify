import { describe, it, expect } from 'vitest'
import { dayLevel, timelineGap, MIDDLE_LEVEL } from './drafts.js'

describe('the week', () => {
  it('climbs from Monday to Saturday', () => {
    // 11/2/2026 is a Monday.
    const week = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']
    expect(week.map(dayLevel)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('puts Sunday in the middle, and a missing date too', () => {
    expect(dayLevel('2026-11-01')).toBe(MIDDLE_LEVEL)
    expect(dayLevel('')).toBe(MIDDLE_LEVEL)
  })

  it('lets Era\'s songs sit closer on harder days', () => {
    expect(timelineGap(0)).toBeGreaterThan(timelineGap(5))
  })
})
