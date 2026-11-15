// Where a clip's beats fall, read from its samples. Tap the Tempo knows each
// song's tempo; this finds where in the clip its beats land, so a click at the
// tempo you tapped can start on one of them.
//
// It reads the decoded clip once, rather than listening while it plays: the
// stage's live beat finder is built for the light, misses beats in a loud
// mix, and doesn't run at all when the phone asks for less motion.

// About 11.6 milliseconds a frame at 44.1 kHz.
const HOP = 512

// Below this the kick drum and the bass, where a beat is easiest to hear.
const LOW_HZ = 180

/**
 * How sharply the sound rises at each frame of the clip, mostly in the low end:
 * the moments a drum or a bass note lands. One value per HOP samples.
 *
 * @param channels   the clip's channels (Float32Arrays of equal length)
 * @param sampleRate samples a second
 */
export function onsets(channels, sampleRate) {
  const length = channels[0]?.length ?? 0
  const frames = Math.floor(length / HOP)
  const out = new Float32Array(frames)
  if (!frames) return out
  const k = 1 - Math.exp((-2 * Math.PI * LOW_HZ) / sampleRate)
  // Left and right together; a clip with more channels is read from its first two.
  const left = channels[0]
  const right = channels[1] ?? left
  let low = 0
  let lastLow = 0
  let lastAll = 0
  for (let f = 0; f < frames; f++) {
    let lowSum = 0
    let allSum = 0
    for (let i = f * HOP, end = i + HOP; i < end; i++) {
      const x = (left[i] + right[i]) * 0.5
      low += k * (x - low)
      lowSum += low * low
      allSum += x * x
    }
    // Loudness on a log scale, so a quiet intro's beats count as much as the
    // chorus's.
    const lowLevel = Math.log1p(1000 * (lowSum / HOP))
    const allLevel = Math.log1p(1000 * (allSum / HOP))
    out[f] = Math.max(0, lowLevel - lastLow) + 0.5 * Math.max(0, allLevel - lastAll)
    lastLow = lowLevel
    lastAll = allLevel
  }
  out[0] = 0
  return out
}

// A song's listed tempo can be a beat a minute out, which over a thirty
// second clip moves the last beats half a beat. The grid is fitted at tempos
// this close to the listed one, this far apart.
const TEMPO_SLACK = 0.03
const TEMPO_STEP = 0.05

/** How well a grid lands on the onsets: their average strength under its beats. */
function gridScore(strength, phase, period) {
  let score = 0
  let beats = 0
  for (let at = phase; at < strength.length; at += period) {
    // A frame either side too: a beat rarely starts on a frame boundary.
    const i = Math.round(at)
    score += (strength[i] ?? 0) + 0.5 * ((strength[i - 1] ?? 0) + (strength[i + 1] ?? 0))
    beats++
  }
  return beats ? score / beats : 0
}

/**
 * Where a song's beats fall in its clip: the grid near `bpm` that lands on the
 * most onsets, as { offset, period } in seconds of the clip.
 *
 * @param strength  onsets() of the clip
 * @param frameTime seconds a frame
 */
export function fitGrid(strength, frameTime, bpm) {
  if (!(bpm > 0) || !strength.length) return { offset: 0, period: bpm > 0 ? 60 / bpm : 0 }
  let best = { offset: 0, period: 60 / bpm, score: -1 }
  for (let tempo = bpm * (1 - TEMPO_SLACK); tempo <= bpm * (1 + TEMPO_SLACK); tempo += TEMPO_STEP) {
    const period = 60 / tempo / frameTime
    for (let phase = 0; phase < period; phase++) {
      const score = gridScore(strength, phase, period)
      if (score > best.score) best = { offset: phase * frameTime, period: 60 / tempo, score }
    }
  }
  return { offset: best.offset, period: best.period }
}

const found = new WeakMap()

/**
 * The song's beat grid in a decoded clip: { offset, period } in seconds of
 * the clip. Worked out once per clip and kept.
 */
export function beatGrid(buffer, bpm) {
  const key = `${bpm}`
  let grids = found.get(buffer)
  if (!grids) {
    grids = new Map()
    found.set(buffer, grids)
  }
  if (!grids.has(key)) {
    const channels = []
    for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c))
    grids.set(key, fitGrid(onsets(channels, buffer.sampleRate), HOP / buffer.sampleRate, bpm))
  }
  return grids.get(key)
}

/** The first beat of a grid at or after `t`, in seconds of the clip. */
export function beatAfter({ offset, period }, t) {
  return offset + Math.max(0, Math.ceil((t - offset) / period - 1e-9)) * period
}
