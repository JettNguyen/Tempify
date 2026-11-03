import { describe, it, expect } from 'vitest'
import { dialAt, peakAt, peakPoints, NEVER, NEVER_FROM } from './peak.js'
import { roundTier, shareSquares, isWin } from './points.js'

describe('the peak dial', () => {
  it('runs from #1 at the left to never charted at the right', () => {
    expect(dialAt(1)).toBe(0)
    expect(dialAt(100)).toBeCloseTo(NEVER_FROM)
    expect(dialAt(NEVER)).toBe(1)
  })

  it('reads back the peak at every place on the chart', () => {
    for (let p = 1; p <= 100; p++) expect(peakAt(dialAt(p))).toBe(p)
    expect(peakAt(0.95)).toBe(NEVER)
  })

  it('gives the top ten about a third of the charted width', () => {
    expect(dialAt(10) / NEVER_FROM).toBeGreaterThan(0.28)
    expect(dialAt(10) / NEVER_FROM).toBeLessThan(0.32)
  })
})

describe('peak points', () => {
  it('pays a full round for the exact peak, never charted included', () => {
    expect(peakPoints(9, 9)).toBe(1000)
    expect(peakPoints(NEVER, NEVER)).toBe(1000)
  })

  it('costs more for a near miss at the top than at the bottom', () => {
    expect(peakPoints(5, 1)).toBeLessThan(peakPoints(65, 60))
    expect(peakPoints(65, 60)).toBeGreaterThan(900)
  })

  it('keeps one place off a #1 close', () => {
    expect(roundTier(peakPoints(2, 1))).toBe('close')
  })

  it("gives no one spot on the dial half the points, so parking there isn't a way to win", () => {
    // A day's songs come one from each zone: the top 10, #11-40, #41-100, never charted.
    const zones = [[1, 10], [11, 40], [41, 100]]
    const averageAt = g => (zones.reduce((sum, [lo, hi]) => {
      let s = 0
      for (let a = lo; a <= hi; a++) s += peakPoints(g, a)
      return sum + s / (hi - lo + 1)
    }, 0) + peakPoints(g, NEVER)) / 4
    for (let g = 0; g <= 100; g++) expect(averageAt(g)).toBeLessThan(450)
  })

  it('treats calling a #100 song never charted as close, not wrong', () => {
    expect(peakPoints(NEVER, 100)).toBeGreaterThan(700)
    expect(peakPoints(NEVER, 1)).toBe(0)
  })

  it('is the same whichever side the guess lands', () => {
    expect(peakPoints(12, 30)).toBe(peakPoints(30, 12))
  })
})

describe('round tiers', () => {
  it('sorts rounds into close, near and far', () => {
    expect(roundTier(1000)).toBe('close')
    expect(roundTier(600)).toBe('near')
    expect(roundTier(200)).toBe('far')
    expect(shareSquares([1000, 600, 200])).toBe('🟩🟨🟥')
  })

  it('wins a day from half the points', () => {
    expect(isWin(2500, 5000)).toBe(true)
    expect(isWin(2499, 5000)).toBe(false)
  })
})
