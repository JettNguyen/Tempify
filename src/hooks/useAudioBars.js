import { useEffect } from 'react'
import { getAnalyser } from '../lib/audioAnalyser'

// Bars never collapse to nothing — a flat line reads as broken, not as quiet.
const FLOOR = 0.22
const BIN_START = 1        // bin 0 is DC, always junk
const BINS_PER_BAR = 3

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

    const analyser = getAnalyser(audio)
    if (!analyser) return

    const bars = Array.from(wave.children)
    const bins = new Uint8Array(analyser.frequencyBinCount)
    wave.classList.add('audio-player__wave--live')

    let frame = requestAnimationFrame(function draw() {
      analyser.getByteFrequencyData(bins)
      for (let i = 0; i < bars.length; i++) {
        let sum = 0
        const from = BIN_START + i * BINS_PER_BAR
        for (let b = from; b < from + BINS_PER_BAR; b++) sum += bins[b] || 0
        const avg = sum / BINS_PER_BAR / 255
        // Musical energy falls away steeply with frequency, so without a lift
        // that grows across the row the right-hand bars sit flat all song.
        const lifted = Math.min(1, avg * (1 + i * 0.22))
        const scale = FLOOR + (1 - FLOOR) * Math.pow(lifted, 0.75)
        bars[i].style.transform = `scaleY(${scale.toFixed(3)})`
      }
      frame = requestAnimationFrame(draw)
    })

    return () => {
      cancelAnimationFrame(frame)
      wave.classList.remove('audio-player__wave--live')
      // Hand the bars back to the CSS animation exactly as it found them.
      bars.forEach((bar) => { bar.style.transform = '' })
    }
  }, [playing, audioRef, waveRef])
}
