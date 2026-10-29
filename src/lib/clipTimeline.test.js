import { describe, it, expect } from 'vitest'
import { buildSegments, timeToBar, barToTime, barToPixel, pixelToBar } from './clipTimeline.js'

const STOPS = [0.5, 1, 2, 5, 15, 30]

describe('buildSegments', () => {
  it('cuts the span at each stop, each stage wider than the last', () => {
    const segs = buildSegments(STOPS, 30)
    expect(segs.map((s) => [s.start, s.end])).toEqual([
      [0, 0.5], [0.5, 1], [1, 2], [2, 5], [5, 15], [15, 30],
    ])
    for (let i = 1; i < segs.length; i++) expect(segs[i].width).toBeGreaterThan(segs[i - 1].width)
    const total = segs.reduce((sum, s) => sum + s.width, 0)
    expect(total).toBeCloseTo(1, 9)
  })

  it('stops at a clip shorter than the ladder', () => {
    const segs = buildSegments(STOPS, 4)
    expect(segs[segs.length - 1].end).toBe(4)
    expect(segs.length).toBe(4)
  })

  it('has nothing to cut without stops or a length', () => {
    expect(buildSegments(null, 30)).toBeNull()
    expect(buildSegments(STOPS, 0)).toBeNull()
    expect(buildSegments(STOPS, Infinity)).toBeNull()
  })
})

describe('time and bar', () => {
  const segs = buildSegments(STOPS, 30)

  it('round-trips between seconds and the bar', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1.5, 3, 10, 22, 30]) {
      expect(barToTime(segs, timeToBar(segs, t))).toBeCloseTo(t, 9)
    }
  })

  it('puts each stop on its segment boundary', () => {
    expect(timeToBar(segs, 0.5)).toBeCloseTo(segs[1].offset, 9)
    expect(timeToBar(segs, 30)).toBeCloseTo(1, 9)
  })
})

describe('bar and pixel', () => {
  const segs = buildSegments(STOPS, 30)
  const width = 300
  const gap = 3

  it('round-trips between the bar and the pixel under it', () => {
    for (const x of [0, 0.02, segs[1].offset + 0.01, 0.4, 0.75, 1]) {
      const px = barToPixel(segs, x, width, gap)
      expect(pixelToBar(segs, px, width, gap)).toBeCloseTo(x, 6)
    }
  })

  it('leaves room for the gaps', () => {
    expect(barToPixel(segs, 1, width, gap)).toBeCloseTo(width, 6)
    // The second segment starts one gap past where the first ended.
    const firstEnd = barToPixel(segs, segs[0].width, width, gap)
    expect(barToPixel(segs, segs[1].offset + 1e-9, width, gap) - firstEnd).toBeCloseTo(gap, 3)
  })

  it('reads a press in a gap as the end of the segment before it', () => {
    const firstEnd = barToPixel(segs, segs[0].width, width, gap)
    expect(pixelToBar(segs, firstEnd + 1.5, width, gap)).toBeCloseTo(segs[0].offset + segs[0].width, 9)
  })

  it('clamps presses off either end', () => {
    expect(pixelToBar(segs, -20, width, gap)).toBe(0)
    expect(pixelToBar(segs, width + 20, width, gap)).toBeCloseTo(1, 9)
    expect(pixelToBar(null, 150, width, gap)).toBe(0.5)
  })
})
