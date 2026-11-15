import { describe, it, expect } from 'vitest'
import { onsets, fitGrid, beatGrid, beatAfter } from './beatGrid.js'

const RATE = 44100
const FRAME = 512 / RATE

// A bass drum: a short 60 Hz thump every 60 / bpm seconds from `first`, over a
// steady hiss, the way a mix never goes quiet between beats.
function drums(bpm, first, seconds = 10, channels = 2) {
  const n = Math.round(seconds * RATE)
  const out = Array.from({ length: channels }, () => new Float32Array(n))
  let seed = 7
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.2
  for (let i = 0; i < n; i++) for (const ch of out) ch[i] = noise()
  for (let t = first; t < seconds; t += 60 / bpm) {
    const start = Math.round(t * RATE)
    for (let i = 0; i < 0.06 * RATE && start + i < n; i++) {
      const v = Math.sin((2 * Math.PI * 60 * i) / RATE) * Math.exp(-i / (0.02 * RATE))
      for (const ch of out) ch[start + i] += v
    }
  }
  return out
}

describe('fitGrid', () => {
  it('finds where the beats fall', () => {
    for (const [bpm, first] of [[120, 0.237], [96, 0.05], [140, 0.4]]) {
      const grid = fitGrid(onsets(drums(bpm, first), RATE), FRAME, bpm)
      expect(Math.abs(grid.offset - first)).toBeLessThan(FRAME * 2)
      expect(grid.period).toBeCloseTo(60 / bpm, 3)
    }
  })

  it('finds the real tempo when the listed one is a little out', () => {
    const grid = fitGrid(onsets(drums(120, 0.3, 20), RATE), FRAME, 121.5)
    expect(grid.period).toBeCloseTo(0.5, 3)
    // So the last beats of the clip still line up.
    const last = grid.offset + 38 * grid.period
    expect(Math.abs(last - (0.3 + 38 * 0.5))).toBeLessThan(FRAME * 2)
  })

  it('reads a clip with one channel', () => {
    const grid = fitGrid(onsets(drums(120, 0.3, 6, 1), RATE), FRAME, 120)
    expect(Math.abs(grid.offset - 0.3)).toBeLessThan(FRAME * 2)
  })

  it('has nothing to go on without a tempo or a clip', () => {
    expect(fitGrid(new Float32Array(100), FRAME, 0).offset).toBe(0)
    expect(fitGrid(new Float32Array(0), FRAME, 120)).toEqual({ offset: 0, period: 0.5 })
  })
})

describe('beatGrid', () => {
  it('reads a decoded clip once and keeps it', () => {
    const data = drums(120, 0.25, 4)
    let reads = 0
    const buffer = {
      numberOfChannels: 2,
      sampleRate: RATE,
      getChannelData: (c) => { reads++; return data[c] },
    }
    const grid = beatGrid(buffer, 120)
    // Four seconds is too short to tell the tempo finer than this.
    expect(grid.period).toBeCloseTo(0.5, 2)
    expect(Math.abs(grid.offset - 0.25)).toBeLessThan(FRAME * 2)
    expect(beatGrid(buffer, 120)).toBe(grid)
    expect(reads).toBe(2)
  })
})

describe('beatAfter', () => {
  const grid = { offset: 0.25, period: 0.5 }

  it('gives the first beat at or after a moment', () => {
    expect(beatAfter(grid, 0)).toBe(0.25)
    expect(beatAfter(grid, 0.25)).toBe(0.25)
    expect(beatAfter(grid, 0.3)).toBe(0.75)
    expect(beatAfter(grid, 10.1)).toBeCloseTo(10.25)
  })
})
