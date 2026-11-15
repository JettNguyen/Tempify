import { describe, it, expect } from 'vitest'
import { carryOnTimes, MAX_BEATS } from './useTapBeat.js'

describe('carryOnTimes', () => {
  // 120 BPM: a beat every 500 milliseconds, the last tap at 1,000.
  it('leaves the beat after the last tap empty and starts on the next', () => {
    expect(carryOnTimes(1000, 120, 1000, 3100)).toEqual([2000, 2500, 3000])
  })

  it('books only what falls in the window', () => {
    expect(carryOnTimes(1000, 120, 2100, 2700)).toEqual([2500])
    expect(carryOnTimes(1000, 120, 2500, 2600)).toEqual([2500])
    expect(carryOnTimes(1000, 120, 2501, 2999)).toEqual([])
  })

  it('stops after the most clicks it plays', () => {
    const all = carryOnTimes(0, 120, 0, 1e9)
    expect(all).toHaveLength(MAX_BEATS)
    expect(all[0]).toBe(1000)
    expect(all[all.length - 1]).toBe((MAX_BEATS + 1) * 500)
    expect(carryOnTimes(0, 120, 0, 1e9, 3)).toEqual([1000, 1500, 2000])
  })

  it('keeps time at an odd tempo', () => {
    const [a, b] = carryOnTimes(0, 97, 0, 2000)
    expect(a).toBeCloseTo(2 * 60000 / 97, 6)
    expect(b - a).toBeCloseTo(60000 / 97, 6)
  })

  it('has nothing to play without a tempo or a tap', () => {
    expect(carryOnTimes(1000, null, 0, 5000)).toEqual([])
    expect(carryOnTimes(null, 120, 0, 5000)).toEqual([])
    expect(carryOnTimes(1000, 120, 3000, 3000)).toEqual([])
  })
})
