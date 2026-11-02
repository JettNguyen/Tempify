import { describe, it, expect } from 'vitest'
import { ACCURACY_GAMES, FIVE_SONG_MAX, dayAccuracy } from './points.js'

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

  it('covers the five-song games, not Cover or Not or One Bar', () => {
    expect([...ACCURACY_GAMES].sort()).toEqual(['era', 'hit-or-miss', 'tempo'])
  })
})
