import { useEffect } from 'react'
import { getAnalyser, primeAudioContext, onContextStateChange } from '../lib/audioAnalyser'

// A bar that is audible at all keeps enough height to stay taller than it is
// wide, so its rounded ends read as ends rather than as a dot.
const FLOOR = 0.2
// Below this a frequency is not quiet, it is absent, so those bars come off the
// row entirely rather than sitting at the floor pretending to carry something.
const SILENT = 0.02
const MAX_HEIGHT = 82        // matches the symbol's tallest bar, as in the CSS

// A spectral tilt across the row. Music carries most of its energy at the bottom
// of the spectrum, so read flat the low bars sit pinned at full height while the
// top of the row barely stirs. Damping the lows matters as much as lifting the
// highs, and only boosting the highs leaves the bass exactly where it was.
const LOW_GAIN = 0.6
const HIGH_GAIN = 2.2
const FIRST_BIN = 1              // bin 0 is DC, always junk
const TOP_FRACTION = 0.7         // above this there is nothing but hiss

/**
 * Musical detail is bunched at the bottom of the spectrum, so the bars are
 * spaced logarithmically. Split linearly and two thirds of the row would sit on
 * frequencies almost no music reaches, leaving that stretch permanently flat.
 */
function binRanges(barCount, binCount) {
  const top = Math.max(FIRST_BIN + 1, Math.floor(binCount * TOP_FRACTION))
  const step = Math.log(top / FIRST_BIN) / barCount
  const ranges = []
  let cursor = FIRST_BIN
  for (let i = 0; i < barCount; i++) {
    // Carried forward rather than recomputed, so the lowest bars, where the
    // curve is flattest, get a bin each instead of all sharing the first one.
    const from = Math.max(cursor, Math.floor(FIRST_BIN * Math.exp(step * i)))
    const to = Math.min(binCount, Math.max(from + 1, Math.floor(FIRST_BIN * Math.exp(step * (i + 1)))))
    ranges.push([from, to])
    cursor = to
  }
  return ranges
}

/**
 * Drives the waveform bars from the audio actually playing, when that is
 * possible. Writes straight to the DOM: this runs every frame, and putting it
 * through React state would re-render the whole player 60 times a second.
 *
 * Does nothing at all when no analyser is available: the canned CSS animation
 * is left running in its place, which is the common case rather than an error.
 */
export function useAudioBars(audioRef, waveRef, playing, barCount) {
  useEffect(() => {
    if (!playing) return
    const audio = audioRef.current
    const wave = waveRef.current
    if (!audio || !wave) return

    // Someone who asked for less motion did not ask for a live equaliser.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const bars = Array.from(wave.children)
    let frame = 0

    function run(analyser) {
      const bins = new Uint8Array(analyser.frequencyBinCount)
      const ranges = binRanges(bars.length, analyser.frequencyBinCount)
      wave.classList.add('audio-player__wave--live')

      const drawn = new Array(bars.length).fill(-1)
      // Per-bar gain, precomputed: the bars are log-spaced, so stepping evenly
      // across the row is stepping evenly across octaves.
      const gains = bars.map((_, i) =>
        LOW_GAIN + (HIGH_GAIN - LOW_GAIN) * (bars.length > 1 ? i / (bars.length - 1) : 0))

      frame = requestAnimationFrame(function draw() {
        analyser.getByteFrequencyData(bins)
        for (let i = 0; i < bars.length; i++) {
          const [from, to] = ranges[i]
          let sum = 0
          for (let b = from; b < to; b++) sum += bins[b]
          const avg = sum / (to - from) / 255

          let height = 0
          if (avg >= SILENT) {
            const tilted = Math.min(1, avg * gains[i])
            height = (FLOOR + (1 - FLOOR) * Math.pow(tilted, 0.8)) * MAX_HEIGHT
          }

          // Skipping unchanged writes keeps a row of silent bars from costing a
          // style recalculation every frame.
          const rounded = Math.round(height * 10) / 10
          if (rounded !== drawn[i]) {
            drawn[i] = rounded
            bars[i].style.height = `${rounded}%`
          }
        }
        frame = requestAnimationFrame(draw)
      })
    }

    // Resuming the context is asynchronous, so the first play routinely arrives
    // before it is awake, and with autoplay, before any tap at all. Ask again
    // when it wakes rather than settling for the canned loop for the whole clip.
    let unsubscribe = () => {}
    const attempt = () => {
      if (frame) return true
      const analyser = getAnalyser(audio)
      if (!analyser) return false
      run(analyser)
      unsubscribe()
      return true
    }

    if (!attempt()) {
      primeAudioContext()
      unsubscribe = onContextStateChange(attempt)
    }

    return () => {
      unsubscribe()
      cancelAnimationFrame(frame)
      wave.classList.remove('audio-player__wave--live')
      // Hand the bars back to the CSS animation exactly as it found them.
      bars.forEach((bar) => { bar.style.height = '' })
    }
  }, [playing, audioRef, waveRef, barCount])
}
