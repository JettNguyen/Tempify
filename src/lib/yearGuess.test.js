import { describe, it, expect } from 'vitest'
import { yearPoints, yearRange } from './yearGuess.js'

describe('yearPoints', () => {
  it('pays in full for the year and less the further off', () => {
    expect(yearPoints(1969, 1969)).toBe(1000)
    expect(yearPoints(1972, 1969)).toBe(750)
    expect(yearPoints(1966, 1969)).toBe(750)
    expect(yearPoints(1981, 1969)).toBe(0)
  })
})

describe('yearRange', () => {
  it('ends at the cover and starts in 1940', () => {
    expect(yearRange(1969, 2004)).toEqual([1940, 2004])
  })

  it('reaches back for a standard older than 1940', () => {
    expect(yearRange(1927, 1998)).toEqual([1900, 1998])
  })
})
