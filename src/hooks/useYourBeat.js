import { useEffect, useRef } from 'react'
import { runningContext } from '../lib/audioEngine'
import { playSoundAt } from '../lib/sounds'

// The beat the stage hears comes in a little after the song played it: the
// analyser looks at a window of sound and the visual checks it once a frame.
// The click starts this much earlier to land with the beat, not after it.
export const HEARD_LATE = 0.05

// Clicks are booked this far ahead on the audio clock, so a busy moment on the
// page can't make one late, and checked for this often.
const AHEAD = 0.25
const EVERY_MS = 60

// The first beats of a clip are the detector settling in; the click waits
// this long after the clip starts before taking one as the downbeat.
const SETTLE = 0.4

/**
 * The clicks at `bpm` from `anchor`, from the moment `from` up to `until`, on
 * the audio clock. One every 60 / bpm seconds, the first on the anchor itself.
 */
export function clickTimes(anchor, bpm, from, until) {
  if (!(bpm > 0) || until <= from) return []
  const period = 60 / bpm
  const times = []
  let k = Math.max(0, Math.ceil((from - anchor) / period - 1e-9))
  for (let t = anchor + k * period; t < until; t = anchor + ++k * period) times.push(t)
  return times
}

/**
 * Tap the Tempo, once a song's answer is in: a click at the tempo you tapped,
 * played over the song. It starts on the song's first clear beat and keeps
 * your tempo from there, so a tempo that was right stays on the beat and one
 * that was off drifts ahead or behind where you can hear it.
 *
 * Hand `onPlayingChange` and `onBeat` to the stage's AudioPlayer.
 */
export function useYourBeat({ bpm, on }) {
  const state = useRef({ playing: false, startedAt: 0, anchor: null, next: 0, timer: 0, sources: [] })

  function stop() {
    const s = state.current
    clearInterval(s.timer)
    s.timer = 0
    s.anchor = null
    for (const source of s.sources) {
      try { source.stop() } catch { /* already finished */ }
    }
    s.sources = []
  }

  function book() {
    const s = state.current
    const c = runningContext()
    if (!c || s.anchor == null) return
    const now = c.currentTime
    for (const t of clickTimes(s.anchor, bpm, Math.max(s.next, now), now + AHEAD)) {
      const source = playSoundAt('beat', t, 0.9)
      if (source) s.sources.push(source)
      s.next = t + 0.001
    }
    // Keep only the clicks that haven't sounded yet.
    if (s.sources.length > 16) s.sources = s.sources.slice(-8)
  }

  function onPlayingChange(playing) {
    const s = state.current
    s.playing = playing
    if (playing) s.startedAt = runningContext()?.currentTime ?? 0
    else stop()
  }

  function onBeat() {
    const s = state.current
    if (!on || !s.playing || s.anchor != null) return
    const c = runningContext()
    if (!c || c.currentTime - s.startedAt < SETTLE) return
    s.anchor = c.currentTime - HEARD_LATE
    s.next = s.anchor
    book()
    s.timer = setInterval(book, EVERY_MS)
  }

  useEffect(() => {
    if (!on) stop()
  }, [on])

  useEffect(() => stop, [])

  return { onPlayingChange, onBeat }
}
