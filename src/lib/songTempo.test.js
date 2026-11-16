import { describe, it, expect } from 'vitest'
import { settleTempo, sameBeat, correctListed } from './songTempo.js'

const read = (bpm, sure = 1.3) => ({ bpm, sure })

describe('settleTempo', () => {
  it("takes the listed number when the clip agrees, at the listing's speed", () => {
    expect(settleTempo(126, read(127))).toEqual({ bpm: 126, check: false })
    expect(settleTempo(170, read(85))).toEqual({ bpm: 170, check: false })
  })

  it('fills in a clean clip read when nothing is listed', () => {
    expect(settleTempo(null, read(114))).toEqual({ bpm: 114, check: false })
  })

  it('asks for a check on a close-call read with nothing to back it', () => {
    expect(settleTempo(null, read(114, 1.01))).toEqual({ bpm: 114, check: true })
  })

  it('asks for a check when the two disagree, leaning on a sure clip read', () => {
    // Love Story (Taylor's Version): listed 111, the record runs at 119.
    expect(settleTempo(111, read(119, 1.24))).toEqual({ bpm: 119, check: true })
    // Wake Up in the Sky: listed 143 and right; the clip read was a close call.
    expect(settleTempo(143, read(114, 1.01))).toEqual({ bpm: 143, check: true })
  })

  it('falls back to the listing when the clip has no read', () => {
    expect(settleTempo(126, null)).toEqual({ bpm: 126, check: false })
  })

  it('leaves it to the maker when there is neither', () => {
    expect(settleTempo(null, null)).toEqual({ bpm: null, check: true })
    expect(settleTempo(0, null)).toEqual({ bpm: null, check: true })
    expect(settleTempo(400, null)).toEqual({ bpm: null, check: true })
  })
})

describe('sameBeat', () => {
  it('counts half and double speed, within 3%', () => {
    expect(sameBeat(120, 120)).toBe(true)
    expect(sameBeat(60, 120)).toBe(true)
    expect(sameBeat(241, 120)).toBe(true)
    expect(sameBeat(80, 120)).toBe(false)
    expect(sameBeat(125, 120)).toBe(false)
  })
})

describe('correctListed', () => {
  it("fixes a listing a few percent off when the clip is sure", () => {
    // Love Story (Taylor's Version): listed 111, the record runs at 119.
    expect(correctListed(111, read(119, 1.24))).toEqual({ bpm: 119, replaced: true })
  })

  it("keeps the listing's speed", () => {
    expect(correctListed(222, read(119, 1.24))).toEqual({ bpm: 238, replaced: true })
  })

  it('leaves a listing the clip agrees with', () => {
    expect(correctListed(126, read(127, 1.5))).toEqual({ bpm: 126, replaced: false })
    expect(correctListed(170, read(85, 1.5))).toEqual({ bpm: 170, replaced: false })
  })

  it('leaves it when the clip is a close call', () => {
    expect(correctListed(143, read(150, 1.05))).toEqual({ bpm: 143, replaced: false })
  })

  it('leaves a gap the size of counting in threes', () => {
    // Lucille: listed 142, the clip read two thirds of it.
    expect(correctListed(142, read(95, 1.19))).toEqual({ bpm: 142, replaced: false })
    // Love Hurts: listed 141, the clip read 80.
    expect(correctListed(141, read(80, 1.64))).toEqual({ bpm: 141, replaced: false })
  })

  it('leaves it with no clip read or no listing', () => {
    expect(correctListed(126, null)).toEqual({ bpm: 126, replaced: false })
    expect(correctListed(null, read(119))).toEqual({ bpm: null, replaced: false })
  })
})
