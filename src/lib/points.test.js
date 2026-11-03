import { describe, it, expect } from 'vitest'
import { ACCURACY_GAMES, FIVE_SONG_MAX, dayAccuracy, dayMax, closeness } from './points.js'

describe('dayAccuracy', () => {
  it('is a five-song day out of 5,000', () => {
    expect(FIVE_SONG_MAX).toBe(5000)
    expect(dayAccuracy(4060)).toBeCloseTo(0.812)
    expect(dayAccuracy(5000)).toBe(1)
  })

  it('stays between none and all of it', () => {
    expect(dayAccuracy(0)).toBe(0)
    expect(dayAccuracy(null)).toBe(0)
    expect(dayAccuracy(5200)).toBe(1)
  })

  it('measures a three-song day out of 3,000', () => {
    expect(dayAccuracy(2400, 3000)).toBeCloseTo(0.8)
    expect(dayMax('hit-or-miss', '2026-11-17')).toBe(3000)
    expect(dayMax('tempo', '2026-11-17')).toBe(3000)
    expect(dayMax('hit-or-miss', '2026-11-16')).toBe(5000)
    expect(dayMax('era', '2026-11-17')).toBe(5000)
  })

  it('covers the games played in rounds, not Cover or Not or One Bar', () => {
    expect([...ACCURACY_GAMES].sort()).toEqual(['era', 'hit-or-miss', 'tempo'])
  })
})

describe('closeness', () => {
  it('is all of it within the full-marks window and none from the far end', () => {
    expect(closeness(0, 1)).toBe(1)
    expect(closeness(0.02, 0.2, 0.03)).toBe(1)
    expect(closeness(1, 1)).toBe(0)
    expect(closeness(2, 1)).toBe(0)
  })

  it('costs little for the first misses and more as they grow', () => {
    const first = 1 - closeness(0.1, 1)
    const later = closeness(0.5, 1) - closeness(0.6, 1)
    expect(first).toBeLessThan(later)
  })
})
