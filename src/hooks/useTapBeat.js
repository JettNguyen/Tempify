import { useEffect, useRef } from 'react'
import { runningContext } from '../lib/audioEngine'
import { playSoundAt, soundEffectsOn } from '../lib/sounds'

// Clicks are booked this far ahead on the audio clock, so a busy moment on the
// page can't make one late, and checked for this often (as in useYourBeat).
const AHEAD_MS = 250
const EVERY_MS = 60

// The beat stops after this many clicks, so a phone left on the table doesn't
// keep clicking on its own.
export const MAX_BEATS = 32

/**
 * The clicks that carry on from the taps, as performance.now() milliseconds
 * from `from` up to `until`: one every 60 / bpm seconds in time with the last
 * tap. The beat right after the last tap goes by empty, since that's how a
 * stop is told from a tap still on its way, and the clicks start on the next
 * one, at most `max` of them.
 */
export function carryOnTimes(lastTap, bpm, from, until, max = MAX_BEATS) {
  if (!(bpm > 0) || lastTap == null || until <= from) return []
  const period = 60000 / bpm
  const times = []
  let k = Math.max(2, Math.ceil((from - lastTap) / period - 1e-9))
  for (let t = lastTap + k * period; t < until && k <= max + 1; t = lastTap + ++k * period) times.push(t)
  return times
}

/**
 * Tap the Tempo, while the beat is being tapped: once there's a tempo and the
 * taps stop, the beat carries on at that tempo, so it can be checked against
 * the song in your head before it's locked in. A new tap stops it, and it
 * picks up again from the new taps once they stop.
 *
 * It plays the tap's own sound, so it goes quiet with the sound effects
 * setting. `onBeat` is called on each click, for the pad to pulse with it.
 *
 * @param taps   tap times in performance.now() milliseconds
 * @param bpm    the tempo they make, or null
 * @param on     false once the beat is locked in
 */
export function useTapBeat({ taps, bpm, on, onBeat }) {
  const onBeatRef = useRef(onBeat)
  onBeatRef.current = onBeat
  const lastTap = taps[taps.length - 1]

  useEffect(() => {
    if (!on || !(bpm > 0) || lastTap == null) return undefined
    const period = 60000 / bpm
    const sources = []
    const timers = []
    let next = lastTap
    let interval = 0

    function book() {
      const c = runningContext()
      if (!c) return
      const now = performance.now()
      for (const t of carryOnTimes(lastTap, bpm, Math.max(next, now), now + AHEAD_MS)) {
        next = t + 1
        if (soundEffectsOn()) {
          const source = playSoundAt('beat', c.currentTime + (t - now) / 1000)
          if (source) sources.push(source)
        }
        timers.push(setTimeout(() => onBeatRef.current?.(t), Math.max(0, t - now)))
      }
      if (next > lastTap + (MAX_BEATS + 1) * period) clearInterval(interval)
    }

    // Half a beat past where the next tap was due, a tap that was coming has
    // come. Until then this is still tapping.
    const start = setTimeout(() => {
      interval = setInterval(book, EVERY_MS)
      book()
    }, Math.max(0, lastTap + 1.5 * period - performance.now()))

    return () => {
      clearTimeout(start)
      clearInterval(interval)
      timers.forEach(clearTimeout)
      for (const source of sources) {
        try { source.stop() } catch { /* already played */ }
      }
    }
  }, [on, bpm, lastTap])
}
