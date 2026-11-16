import { fitGrid, gridScore } from './beatGrid.js'

// A song's tempo, read from its clip: how often the drum and bass hits that
// onsets() finds repeat. For Tap the Tempo games a player makes, where the
// store's listed tempo is missing for many songs.
//
// Checked 11/15/2026 against the 114 songs of the daily Tap the Tempo up to
// 11/29, whose tempos were checked by tapping: 113 came within 3%, counting
// half and double speed as right the way the game's scoring does. The one
// miss read Missy Elliott's "Lose Control" at two thirds of its tempo, and
// was also the read it was least sure of.

const LOW = 50
const HIGH = 220

/** Below this a read is a close call between two tempos, worth a person checking. */
export const SURE_ENOUGH = 1.03

// Pop tempos sit around 120, so a tempo far from it needs more evidence.
// `spread` is in octaves.
const nearUsual = (bpm, spread) => Math.exp(-0.5 * (Math.log2(bpm / 120) / spread) ** 2)

/** The onsets less their running average, so a loud chorus doesn't outweigh the verse. */
function detrend(strength, frameTime) {
  const width = Math.max(1, Math.round(0.4 / frameTime))
  const out = new Float32Array(strength.length)
  let sum = 0
  for (let i = 0; i < strength.length; i++) {
    sum += strength[i] - (i - width >= 0 ? strength[i - width] : 0)
    out[i] = Math.max(0, strength[i] - sum / Math.min(i + 1, width))
  }
  return out
}

function autocorrelation(values, maxLag) {
  const out = new Float64Array(maxLag + 2)
  for (let lag = 1; lag < out.length; lag++) {
    let sum = 0
    for (let i = lag; i < values.length; i++) sum += values[i] * values[i - lag]
    out[lag] = sum / Math.max(1, values.length - lag)
  }
  return out
}

const between = (list, x) => {
  const i = Math.floor(x)
  const f = x - i
  return (list[i] ?? 0) * (1 - f) + (list[i + 1] ?? 0) * f
}

/** How hard the beats land on the best grid near `bpm`, and that grid's exact tempo. */
function landing(strength, frameTime, bpm) {
  const grid = fitGrid(strength, frameTime, bpm)
  const period = grid.period / frameTime
  return { bpm: 60 / grid.period, strength: gridScore(strength, grid.offset / frameTime, period) }
}

/**
 * The tempo of a clip from onsets() of it, as { bpm, sure }, or null for a
 * clip with no beat to find. `sure` compares the winning tempo with the
 * runner-up; under SURE_ENOUGH the two were close.
 *
 * A tempo is scored on how well the hits repeat one beat apart, and also half
 * a beat, two beats and a bar apart: the way a real beat sits in its bar.
 * Repeats one beat apart alone fall for triplet hi-hats and swing, reading a
 * song at two thirds or four thirds of its tempo. The best few, including
 * those near misses, are then weighed by how hard their beats land.
 */
export function clipTempo(strength, frameTime) {
  if (!strength?.length || !(frameTime > 0)) return null
  const flat = detrend(strength, frameTime)
  const repeats = autocorrelation(flat, Math.ceil((4 * 60) / (LOW * frameTime)))

  let lead = null
  for (let bpm = LOW; bpm <= HIGH; bpm += 0.25) {
    const lag = 60 / (bpm * frameTime)
    const score = (0.5 * between(repeats, lag / 2) + between(repeats, lag) + 0.5 * between(repeats, lag * 2) + 0.5 * between(repeats, lag * 4))
      * nearUsual(bpm, 1)
    if (!lead || score > lead.score) lead = { bpm, score }
  }
  if (!lead || lead.score <= 0) return null

  const [best, next] = [1, 2 / 3, 3 / 2, 4 / 3, 3 / 4]
    .map(k => lead.bpm * k)
    .filter(bpm => bpm >= LOW && bpm <= HIGH)
    .map(bpm => landing(strength, frameTime, bpm))
    .map(c => ({ ...c, score: c.strength * nearUsual(c.bpm, 1.5) }))
    .sort((a, b) => b.score - a.score)
  if (!(best?.score > 0)) return null
  return { bpm: Math.round(best.bpm), sure: next?.score > 0 ? best.score / next.score : Infinity }
}
