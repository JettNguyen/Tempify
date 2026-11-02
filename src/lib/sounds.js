// The games' sound effects: a tap, locking in, right and wrong, the beat of Tap
// the Tempo's pad, the tick of Hit or Miss's dial, and the day's result.
//
// They were made in code rather than recorded, and ship as the WAVs in
// public/sounds. The code that made them, and the page Jett picked them on, are
// in his Drive under Tempify/Sounds; export-wavs.py there writes this set again.
// Like the clips, they play from decoded buffers on the shared audio context,
// never from audio elements (see audioEngine.js).
//
// They only sound once a game has the context running. A sound anywhere else
// would have to start it first, and starting it takes the phone's audio away
// from whatever else was playing.

import { decodeSound, duckMusic, runningContext } from './audioEngine'

// The bigger sounds play over the music rather than wait for it, so the music
// steps back under them. A tap or a tick is too small and too frequent for that.
const SOUNDS = {
  tap: { duck: false },
  tick: { duck: false },
  beat: { duck: false },
  lockin: { duck: true },
  right: { duck: true },
  wrong: { duck: true },
  win: { duck: true },
  lost: { duck: true },
  challenge: { duck: true },
}

// A setting for this device rather than the account: whether a phone should
// make sounds is about where the phone is.
const PREF_KEY = 'tempify_sound_effects'

function readPref() {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off'
  } catch {
    return true
  }
}

let enabled = readPref()
const buffers = new Map()
let loading = null

export function soundEffectsOn() {
  return enabled
}

export function setSoundEffects(on) {
  enabled = Boolean(on)
  try {
    localStorage.setItem(PREF_KEY, enabled ? 'on' : 'off')
  } catch {
    // Storage blocked: the choice still holds until the app closes.
  }
}

/** Fetches and decodes the whole set once, about a megabyte, so no sound is late the first time. */
export function loadSounds() {
  if (loading || typeof fetch === 'undefined') return loading
  const base = import.meta.env.BASE_URL || '/'
  loading = Promise.all(Object.keys(SOUNDS).map((name) => (
    fetch(`${base}sounds/${name}.wav`)
      .then((res) => {
        if (!res.ok) throw new Error(`Sound request failed: ${res.status}`)
        return res.arrayBuffer()
      })
      .then(decodeSound)
      .then((buffer) => { buffers.set(name, buffer) })
      // A sound that can't load stays quiet; the game doesn't need it.
      .catch(() => {})
  )))
  return loading
}

/** Plays a sound right away, over whatever else is playing. */
export function playSound(name) {
  if (!enabled || !name) return
  const c = runningContext()
  const buffer = buffers.get(name)
  if (!c || !buffer) return
  const source = c.createBufferSource()
  source.buffer = buffer
  source.connect(c.destination)
  source.onended = () => source.disconnect()
  source.start()
  if (SOUNDS[name]?.duck) duckMusic(buffer.duration)
}

/** Right for an answer that scored well, wrong for one that was far off. */
export function playVerdict(tier) {
  playSound(tier === 'far' ? 'wrong' : 'right')
}
