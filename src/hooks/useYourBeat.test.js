import { describe, it, expect } from 'vitest'
import { clickTimes } from './useYourBeat.js'

describe('clickTimes', () => {
  it('clicks once a beat at the tempo, starting on the anchor', () => {
    expect(clickTimes(10, 120, 10, 11.6)).toEqual([10, 10.5, 11, 11.5])
  })

  it('books only the clicks still ahead', () => {
    expect(clickTimes(10, 120, 10.6, 11.6)).toEqual([11, 11.5])
  })

  it('keeps its own grid however late it is asked', () => {
    const times = clickTimes(10, 100, 40, 41)
    expect(times).toHaveLength(2)
    for (const t of times) {
      const beats = (t - 10) / 0.6
      expect(beats - Math.round(beats)).toBeCloseTo(0, 6)
    }
  })

  it('books nothing for an empty window or no tempo', () => {
    expect(clickTimes(10, 120, 11, 11)).toEqual([])
    expect(clickTimes(10, 0, 10, 12)).toEqual([])
    expect(clickTimes(10, undefined, 10, 12)).toEqual([])
  })
})
