import { useEffect } from 'react'
import { getAnalyser, primeAudioContext, onContextStateChange } from '../lib/audioAnalyser'

// Bars never collapse to nothing — a flat line reads as broken, not as quiet.
// Scaling is about the centre line, so this is a half-height either way.
const FLOOR = 0.05
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
    // Carried forward rather than recomputed, so the lowest bars — where the
    // curve is flattest — get a bin each instead of all sharing the first one.
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
 * Does nothing at all when no analyser is available — the canned CSS animation
 * is left running in its place, which is the common case rather than an error.
 */
export function useAudioBars(audioRef, waveRef, playing) {
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

      frame = requestAnimationFrame(function draw() {
        analyser.getByteFrequencyData(bins)
        for (let i = 0; i < bars.length; i++) {
          const [from, to] = ranges[i]
          let sum = 0
          for (let b = from; b < to; b++) sum += bins[b]
          const avg = sum / (to - from) / 255
          // Energy still falls away towards the top even on a log scale, so lift
          // the higher bars or the right-hand end sits flat all song.
          const lifted = Math.min(1, avg * (1 + i * 0.045))
          const scale = FLOOR + (1 - FLOOR) * Math.pow(lifted, 0.8)
          bars[i].style.transform = `scaleY(${scale.toFixed(3)})`
        }
        frame = requestAnimationFrame(draw)
      })
    }

    // Resuming the context is asynchronous, so the first play routinely arrives
    // before it is awake — and with autoplay, before any tap at all. Ask again
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
      bars.forEach((bar) => { bar.style.transform = '' })
    }
  }, [playing, audioRef, waveRef])
}
