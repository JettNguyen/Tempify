import { useEffect, useRef } from 'react'
import { runningContext } from '../lib/audioEngine'
import { beatAfter, beatGrid } from '../lib/beatGrid'
import { playSoundAt } from '../lib/sounds'

// Clicks are booked this far ahead on the audio clock, so a busy moment on the
// page can't make one late, and checked for this often.
const AHEAD = 0.25
const EVERY_MS = 60

// The first click waits for a beat at least this far into what's playing, past
// the clip's fade in.
const LEAD_IN = 0.2

/**
 * The clicks at `bpm` from `anchor`, from the moment `from` up to `until`, in
 * seconds of the clip. One every 60 / bpm seconds, the first on the anchor.
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
 * played over the song. It starts on one of the song's beats (`songBpm` says
 * where they fall; see beatGrid) and keeps your tempo from there, so a tempo
 * that was right stays on the beat and one that was off drifts ahead or behind
 * where you can hear it. Playing from somewhere else starts it again there.
 *
 * Hand `onPlayingChange` to the stage's AudioPlayer.
 */
export function useYourBeat({ bpm, songBpm, on }) {
  const state = useRef({ voice: null, playing: false, anchor: null, shift: 0, next: 0, timer: 0, sources: [] })

  function silence() {
    const s = state.current
    for (const source of s.sources) {
      try { source.stop() } catch { /* already finished */ }
    }
    s.sources = []
  }

  function stop() {
    const s = state.current
    clearInterval(s.timer)
    s.timer = 0
    s.anchor = null
    silence()
  }

  function book() {
    const s = state.current
    const c = runningContext()
    const voice = s.voice
    // Only a clip decoded into a buffer can be read for its beats, and only
    // once it is actually sounding is its clock known.
    if (!c || !voice?.buffer || !voice.playing) return
    // Where the clip is on the audio clock: its moment t plays at t + shift.
    const shift = voice.startedAt - voice.from
    if (s.anchor == null || Math.abs(shift - s.shift) > 0.02) {
      // Started, or moved to another point in the clip: begin again there.
      silence()
      s.shift = shift
      s.anchor = beatAfter(beatGrid(voice.buffer, songBpm), voice.from + LEAD_IN)
      s.next = s.anchor
    }
    const now = c.currentTime - shift
    for (const t of clickTimes(s.anchor, bpm, Math.max(s.next, now), Math.min(now + AHEAD, voice.until))) {
      const source = playSoundAt('beat', t + shift, 0.9)
      if (source) s.sources.push(source)
      s.next = t + 0.001
    }
    // Keep only the clicks that haven't sounded yet.
    if (s.sources.length > 16) s.sources = s.sources.slice(-8)
  }

  function run() {
    const s = state.current
    if (s.timer || !on || !s.playing || !(bpm > 0) || !(songBpm > 0)) return
    s.timer = setInterval(book, EVERY_MS)
    book()
  }

  function onPlayingChange(playing, voice) {
    const s = state.current
    s.playing = playing
    s.voice = voice ?? null
    if (playing) run()
    else stop()
  }

  useEffect(() => {
    if (on) run()
    else stop()
  }, [on])

  useEffect(() => stop, [])

  return { onPlayingChange }
}
