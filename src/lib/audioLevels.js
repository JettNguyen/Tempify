// How loud each part of the spectrum is right now, as plain numbers from 0 to 1,
// for the stage visuals to draw from.

// Below this a frequency is not quiet, it is absent.
export const SILENT = 0.02

// A spectral tilt across the bands. Music carries most of its energy at the
// bottom of the spectrum, so read flat the low bands sit pinned at full height
// while the top barely stirs. Damping the lows matters as much as lifting the
// highs, and only boosting the highs leaves the bass exactly where it was.
const LOW_GAIN = 0.6
const HIGH_GAIN = 2.2
const FIRST_BIN = 1              // bin 0 is DC, always junk
const TOP_FRACTION = 0.7         // above this there is nothing but hiss

/**
 * Musical detail is bunched at the bottom of the spectrum, so the bands are
 * spaced logarithmically. Split linearly and two thirds of them would sit on
 * frequencies almost no music reaches, leaving that stretch permanently flat.
 */
export function binRanges(bandCount, binCount) {
  const top = Math.max(FIRST_BIN + 1, Math.floor(binCount * TOP_FRACTION))
  const step = Math.log(top / FIRST_BIN) / bandCount
  const ranges = []
  let cursor = FIRST_BIN
  for (let i = 0; i < bandCount; i++) {
    // Carried forward rather than recomputed, so the lowest bands, where the
    // curve is flattest, get a bin each instead of all sharing the first one.
    const from = Math.max(cursor, Math.floor(FIRST_BIN * Math.exp(step * i)))
    const to = Math.min(binCount, Math.max(from + 1, Math.floor(FIRST_BIN * Math.exp(step * (i + 1)))))
    ranges.push([from, to])
    cursor = to
  }
  return ranges
}

/**
 * Reads an analyser into `out` (one value per band, tilted, 0-1). Holds its
 * scratch arrays between frames: this runs sixty times a second.
 */
export function createBandReader(analyser, bandCount) {
  const bins = new Uint8Array(analyser.frequencyBinCount)
  const ranges = binRanges(bandCount, analyser.frequencyBinCount)
  // Per-band gain, precomputed: the bands are log-spaced, so stepping evenly
  // across them is stepping evenly across octaves.
  const gains = ranges.map((_, i) =>
    LOW_GAIN + (HIGH_GAIN - LOW_GAIN) * (bandCount > 1 ? i / (bandCount - 1) : 0))

  return function read(out) {
    analyser.getByteFrequencyData(bins)
    for (let i = 0; i < bandCount; i++) {
      const [from, to] = ranges[i]
      let sum = 0
      for (let b = from; b < to; b++) sum += bins[b]
      const avg = sum / (to - from) / 255
      out[i] = avg < SILENT ? 0 : Math.min(1, avg * gains[i])
    }
    return out
  }
}

/**
 * A stand-in for when the sound can't be read, so the stage still moves with
 * something like music rather than freezing. Slow drifts across the bands with
 * a pulse at 118 beats a minute on the low end.
 */
export function synthBands(out, t) {
  const n = out.length
  const beat = Math.pow(Math.max(0, Math.cos(t * Math.PI * (118 / 60))), 6)
  for (let i = 0; i < n; i++) {
    const x = n > 1 ? i / (n - 1) : 0
    const drift = 0.5 + 0.25 * Math.sin(t * 1.7 + i * 0.83) + 0.15 * Math.sin(t * 3.1 + i * 2.17)
    const shape = 0.55 + 0.45 * Math.sin(Math.PI * (0.15 + x * 0.8))
    out[i] = Math.min(1, Math.max(0, drift * shape * 0.8 + beat * (1 - x) * 0.35))
  }
  return out
}

/**
 * Notices beats in the low end: a jump well above its own recent average.
 * Returns a function taking the current bass level and the time, which answers
 * true on the frame a beat lands.
 */
export function createBeatDetector({ ratio = 1.35, floor = 0.3, gapMs = 240 } = {}) {
  let average = 0
  let last = -Infinity
  return function hit(bass, now) {
    const beat = bass > floor && bass > average * ratio && now - last > gapMs
    average += (bass - average) * 0.08
    if (beat) last = now
    return beat
  }
}

/** Frame-rate independent easing toward a target: `rate` is per 60fps frame. */
export function approach(current, target, rate, dt) {
  const k = 1 - Math.pow(1 - rate, dt * 60)
  return current + (target - current) * k
}
