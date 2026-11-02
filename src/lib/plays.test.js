import { describe, it, expect } from 'vitest'
import { arrivalFrom, recentDays } from './plays.js'

describe('how a visit started', () => {
  it('reads a challenge link', () => {
    expect(arrivalFrom('?date=2026-11-02&vs=850.600.1000.0.420&by=sam', '', 'tempify.me'))
      .toEqual({ arrived: 'challenge', referrer: null })
  })

  it('reads a shared link', () => {
    expect(arrivalFrom('?date=2026-10-30&s=share', '', 'tempify.me').arrived).toBe('share')
  })

  it('calls anything else direct', () => {
    expect(arrivalFrom('', '', 'tempify.me').arrived).toBe('direct')
    expect(arrivalFrom('?date=2026-10-30', '', 'tempify.me').arrived).toBe('direct')
  })

  it('keeps only the referring host', () => {
    expect(arrivalFrom('', 'https://www.reddit.com/r/WebGames/comments/abc/tempify/', 'tempify.me').referrer)
      .toBe('reddit.com')
    expect(arrivalFrom('', 'https://t.co/xyz', 'tempify.me').referrer).toBe('t.co')
  })

  it('never counts our own site as where someone came from', () => {
    expect(arrivalFrom('', 'https://tempify.me/game/era', 'tempify.me').referrer).toBe(null)
    expect(arrivalFrom('', 'https://www.tempify.me/', 'tempify.me').referrer).toBe(null)
  })

  it('ignores a referrer that is not an address', () => {
    expect(arrivalFrom('', 'not a url', 'tempify.me').referrer).toBe(null)
  })
})

describe('days played lately', () => {
  it('counts distinct days in the week before today', () => {
    const days = ['2026-10-26', '2026-10-27', '2026-10-30', '2026-11-01', '2026-11-01']
    expect(recentDays(days, '2026-11-02')).toBe(4)
  })

  it('leaves out today and anything older than a week', () => {
    expect(recentDays(['2026-11-02', '2026-10-25'], '2026-11-02')).toBe(0)
  })

  it('crosses a month and a clock change', () => {
    expect(recentDays(['2026-10-31', '2026-11-01'], '2026-11-03')).toBe(2)
  })
})
