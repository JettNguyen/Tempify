import { describe, it, expect } from 'vitest'
import { rightGaps, gapPoints, gapLabel } from './timeline.js'

describe('rightGaps', () => {
  it('finds the one gap a song belongs in', () => {
    expect(rightGaps([1975, 1988], 1960)).toEqual([0, 0])
    expect(rightGaps([1975, 1988], 1981)).toEqual([1, 1])
    expect(rightGaps([1975, 1988], 2001)).toEqual([2, 2])
  })

  it('takes either side of a song from the same year', () => {
    expect(rightGaps([1975, 1988], 1975)).toEqual([0, 1])
  })
})

describe('gapPoints', () => {
  it('pays in full for the right gap and some for a neighbor', () => {
    expect(gapPoints(1, [1, 1])).toBe(1000)
    expect(gapPoints(0, [1, 1])).toBe(500)
    expect(gapPoints(2, [1, 1])).toBe(500)
    expect(gapPoints(3, [1, 1])).toBe(0)
  })

  it('counts either gap around a tie as right', () => {
    expect(gapPoints(0, [0, 1])).toBe(1000)
    expect(gapPoints(1, [0, 1])).toBe(1000)
    expect(gapPoints(2, [0, 1])).toBe(500)
  })
})

describe('gapLabel', () => {
  it('says where a gap is', () => {
    expect(gapLabel([1975, 1988], 0)).toBe('Before 1975')
    expect(gapLabel([1975, 1988], 1)).toBe('Between 1975 and 1988')
    expect(gapLabel([1975, 1988], 2)).toBe('After 1988')
  })
})
