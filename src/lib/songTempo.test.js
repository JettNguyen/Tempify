import { describe, it, expect } from 'vitest'
import { settleTempo, sameBeat } from './songTempo.js'

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
