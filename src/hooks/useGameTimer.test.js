import { describe, it, expect } from 'vitest'
import { restoredElapsedMs } from './useGameTimer.js'

describe('restoredElapsedMs', () => {
  it('picks up a clock saved paused, from before clocks ran on, where it stopped', () => {
    expect(restoredElapsedMs({ elapsedMs: 12000, delayRemainingMs: 0, startedAtMs: null }, 99000)).toBe(12000)
  })

  it('counts the time since a running clock started, so leaving or reloading never winds it back', () => {
    // Started at 50s with 12s already on it; reloaded at 80s.
    expect(restoredElapsedMs({ elapsedMs: 12000, delayRemainingMs: 0, startedAtMs: 50000 }, 80000)).toBe(42000)
  })

  it('counts a reload straight after the start from zero', () => {
    expect(restoredElapsedMs({ elapsedMs: 0, delayRemainingMs: 0, startedAtMs: 1000 }, 31000)).toBe(30000)
  })

  it('never takes time off when the device clock has gone backward', () => {
    expect(restoredElapsedMs({ elapsedMs: 5000, delayRemainingMs: 0, startedAtMs: 90000 }, 60000)).toBe(5000)
  })
})
