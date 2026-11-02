import { describe, it, expect } from 'vitest'
import { dayLevel, timelineGap, MIDDLE_LEVEL, songKey } from './drafts.js'

describe('the week', () => {
  it('climbs from Monday to Sunday, like the agent\'s difficulty_tier', () => {
    // 11/2/2026 is a Monday.
    const week = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']
    expect(week.map(dayLevel)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('puts a missing date in the middle', () => {
    expect(dayLevel('')).toBe(MIDDLE_LEVEL)
  })

  it('lets Era\'s songs sit closer on harder days', () => {
    expect(timelineGap(1)).toBeGreaterThan(timelineGap(7))
  })
})

describe('song keys', () => {
  it('reads & as and, the way Billboard prints it', () => {
    expect(songKey('Show & Tell', 'Al Wilson')).toBe(songKey('Show And Tell', 'Al Wilson'))
  })
})
