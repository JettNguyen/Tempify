import { describe, it, expect } from 'vitest'
import { clipTempo, SURE_ENOUGH } from './clipTempo.js'

// onsets() frames at 44.1 kHz, and a 30 second clip's worth of them.
const FRAME = 512 / 44100
const FRAMES = Math.floor(30 / FRAME)

/** Onset strength for hits every `step` beats at `bpm`, as loud as `level`. */
function hits(bpm, { step = 1, level = 1, from = 0.05 } = {}, into = new Float32Array(FRAMES)) {
  for (let t = from; t < 30; t += (60 / bpm) * step) {
    const i = Math.round(t / FRAME)
    if (i < into.length) into[i] += level
  }
  return into
}

/** A drum pattern: kick and snare on the beats, quieter hats between. */
function beat(bpm, hat = 0.5) {
  const out = hits(bpm, { step: 1, level: 1 })
  return hits(bpm, { step: 0.5, level: hat, from: 0.05 + 30 / bpm }, out)
}

const sameBeat = (got, want) => [want, want / 2, want * 2].some(t => Math.abs(got - t) / t <= 0.03)

describe('clipTempo', () => {
  it('reads a steady beat', () => {
    for (const bpm of [72, 93, 120, 128, 150]) {
      const read = clipTempo(beat(bpm), FRAME)
      expect(sameBeat(read.bpm, bpm), `${bpm} read as ${read.bpm}`).toBe(true)
    }
  })

  it('lands on the exact tempo, not just near it', () => {
    expect(Math.abs(clipTempo(beat(126), FRAME).bpm - 126)).toBeLessThanOrEqual(1)
  })

  it("isn't pulled to two thirds or four thirds by triplet hi-hats", () => {
    const bpm = 100
    const out = beat(bpm, 0.3)
    hits(bpm, { step: 1 / 3, level: 0.45, from: 0.05 + 20 / bpm }, out)
    const read = clipTempo(out, FRAME)
    expect(sameBeat(read.bpm, bpm), `read as ${read.bpm}`).toBe(true)
  })

  it('says how sure it is', () => {
    const read = clipTempo(beat(120), FRAME)
    expect(read.sure).toBeGreaterThanOrEqual(1)
    expect(SURE_ENOUGH).toBeGreaterThan(1)
  })

  it('has nothing for a clip with no beat', () => {
    expect(clipTempo(new Float32Array(FRAMES), FRAME)).toBe(null)
    expect(clipTempo(new Float32Array(0), FRAME)).toBe(null)
    expect(clipTempo(null, FRAME)).toBe(null)
  })
})
