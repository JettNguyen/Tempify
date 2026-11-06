import { describe, it, expect } from 'vitest'
import { addTap, bpmFromTaps, readTap, tempoOff, tempoPoints, RESTART_AFTER_MS } from './tempo.js'

const steady = (bpm, n, from = 0) => Array.from({ length: n }, (_, i) => from + i * (60000 / bpm))

describe('taps', () => {
  it('reads a steady 120 as 120', () => {
    expect(bpmFromTaps(steady(120, 8))).toBe(120)
  })

  it('waits for four taps', () => {
    expect(bpmFromTaps(steady(120, 3))).toBe(null)
  })

  it('shrugs off one late tap', () => {
    const taps = steady(100, 8)
    taps[5] += 180
    expect(bpmFromTaps(taps)).toBe(100)
  })

  it('starts over after a long pause', () => {
    let taps = steady(120, 5)
    taps = addTap(taps, taps[taps.length - 1] + RESTART_AFTER_MS + 1)
    expect(taps).toHaveLength(1)
  })
})

describe('tempo points', () => {
  it('pays in full for the tempo, and for half or double it', () => {
    expect(tempoPoints(117, 117)).toBe(1000)
    expect(tempoPoints(234, 117)).toBe(1000)
    expect(tempoPoints(85, 170)).toBe(1000)
  })

  it("counts a tap's small wobble as right on the beat", () => {
    expect(tempoPoints(103, 100)).toBe(1000)
    expect(tempoPoints(97, 100)).toBe(1000)
  })

  it('never takes points for being one off', () => {
    expect(tempoPoints(86, 87)).toBe(1000)
    expect(tempoPoints(61, 60)).toBe(1000)
  })

  it('scores a tap near half speed against half the song', () => {
    expect(tempoPoints(80, 170)).toBe(930)
  })

  it('pays less the further off, and nothing from 20% out', () => {
    expect(tempoOff(110, 100)).toBeCloseTo(0.1)
    expect(tempoPoints(105, 100)).toBe(960)
    expect(tempoPoints(108, 100)).toBe(840)
    expect(tempoPoints(110, 100)).toBe(736)
    expect(tempoPoints(115, 100)).toBe(407)
    expect(tempoPoints(120, 100)).toBe(0)
    expect(tempoPoints(125, 100)).toBe(0)
  })
})

describe('how a round reads', () => {
  it('says when a tap scored off half or double the speed', () => {
    expect(readTap(80, 170, tempoPoints(80, 170))).toEqual({ speed: 0.5, percentOff: 6 })
    expect(readTap(230, 115, tempoPoints(230, 115))).toEqual({ speed: 2, percentOff: 0 })
  })

  it('leaves a plain tap on the song itself', () => {
    expect(readTap(110, 100, tempoPoints(110, 100))).toEqual({ speed: 1, percentOff: 10 })
  })

  it("doesn't call a tap half speed when it earned nothing", () => {
    expect(tempoPoints(110, 170)).toBe(0)
    expect(readTap(110, 170, 0)).toEqual({ speed: 1, percentOff: 35 })
  })
})
