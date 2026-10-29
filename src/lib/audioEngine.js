// Clip playback for the games: each clip is fetched once, decoded into memory,
// and played on the audio clock.
//
// This used to stream through an <audio> element, which a phone serves badly
// for what One Bar asks of it. Every seek flushes the decoder and refills it, so
// a drag that seeked on each pixel stuttered, and a replay from the top that
// started before its seek had landed sounded a sliver of the old spot first. The
// time the element reports also runs ahead of the speaker, and the visualizer
// routed it through Web Audio on top of that, which put a second buffer between
// the decoder and the speaker and let the sound drift off the playhead.
//
// A preview is thirty seconds and about a megabyte, so holding the whole thing
// decoded is cheap. Starting, stopping and seeking are then scheduled on the
// audio thread to the sample: the One Bar cutoff is part of the call that starts
// the clip rather than something a frame loop has to catch in time, and the
// playhead reads the same clock the sound comes out on.
//
// A clip that can't be fetched or decoded here (no Web Audio, a host that
// refuses cross-origin reads, a codec the browser lacks) falls back to an
// element, so it always plays, even where it can't play this well.

let ctx = null
let armed = false

// A few milliseconds either side of every start and stop. A clip cut mid-wave
// clicks, and at One Bar's half second the click is a fair share of the clip.
const FADE = 0.005
// How far ahead a start is scheduled. The main thread's view of the clock trails
// the audio thread by up to a hardware buffer, and a start that lands in the
// past begins late without moving its offset, which would leave the playhead
// ahead of the sound by however late it was.
const LEAD = 0.03
// Decoded, a thirty second clip is around 11MB, so only the last few are kept.
// That still covers going back into a game, and One Bar swapping its player for
// the full track at the end of a round.
const DECODED_KEEP = 3
// Fetched but not yet decoded: a megabyte each, warmed from the home screen.
const FETCHED_KEEP = 6

export function hasWebAudio() {
  return typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext)
}

// iOS mutes Web Audio with the ringer switch unless the page asks for the
// playback session. An <audio> element got that session without asking, so
// without this, moving off the element would silence every phone set to vibrate.
// Safari 16.4 and later; anything older keeps the default session.
function claimPlaybackSession() {
  try {
    const session = typeof navigator !== 'undefined' ? navigator.audioSession : null
    if (session && session.type !== 'playback') session.type = 'playback'
  } catch {
    // Refused or unsupported: the default session still plays.
  }
}

function getContext() {
  if (ctx) return ctx
  if (!hasWebAudio()) return null
  const Ctor = window.AudioContext || window.webkitAudioContext
  try {
    ctx = new Ctor()
  } catch {
    return null
  }
  claimPlaybackSession()
  return ctx
}

/** Start the context from a real user gesture, the only thing Safari accepts. */
export function primeAudioContext() {
  const c = getContext()
  claimPlaybackSession()
  if (c && c.state !== 'running' && c.state !== 'closed') c.resume().catch(() => {})
}

/** One shared listener: the first tap anywhere in the app starts the context. */
export function armAudioContext() {
  if (armed || typeof document === 'undefined') return
  armed = true
  const start = () => primeAudioContext()
  document.addEventListener('pointerdown', start, { once: true, passive: true })
  document.addEventListener('touchend', start, { once: true, passive: true })
}

/** Resolves true once the context is running, or false if it isn't within `ms`. */
function whenRunning(c, ms) {
  if (c.state === 'running') return Promise.resolve(true)
  return new Promise((resolve) => {
    const check = () => { if (c.state === 'running') settle(true) }
    const timer = setTimeout(() => settle(c.state === 'running'), ms)
    function settle(value) {
      clearTimeout(timer)
      c.removeEventListener?.('statechange', check)
      resolve(value)
    }
    c.addEventListener?.('statechange', check)
  })
}

/**
 * The context time the speaker is playing right now. `currentTime` is what the
 * audio thread has rendered, which is ahead of what can be heard by the output
 * latency (a few milliseconds on the phone's speaker, a fifth of a second or
 * more over Bluetooth), and on a phone it moves in steps of a whole hardware
 * buffer. The output timestamp says which context time reached the speaker at
 * which moment, so carrying it forward to now is both smoother and on time.
 */
export function heardTime(c) {
  const stamp = c.getOutputTimestamp?.()
  if (stamp && stamp.contextTime > 0 && stamp.performanceTime > 0) {
    const t = stamp.contextTime + (performance.now() - stamp.performanceTime) / 1000
    // A stamp from before a suspend, or one that has run off, is worse than
    // the coarse clock it is meant to refine.
    if (Math.abs(c.currentTime - t) < 0.5) return t
  }
  return c.currentTime
}

// ================================
// LOADING
// ================================

const decoded = new Map()
const fetched = new Map()

/** Map insertion order doubles as recency: re-inserting moves a key to the end. */
function keep(map, key, value, limit) {
  map.delete(key)
  map.set(key, value)
  while (map.size > limit) map.delete(map.keys().next().value)
}

function fetchClip(url) {
  return fetch(url, { credentials: 'omit' }).then((res) => {
    if (!res.ok) throw new Error(`Clip request failed: ${res.status}`)
    return res.arrayBuffer()
  })
}

function decode(c, bytes) {
  return new Promise((resolve, reject) => {
    // The callbacks as well as the promise: older Safari only has the callbacks,
    // and settling twice is harmless.
    const pending = c.decodeAudioData(bytes, resolve, reject)
    if (pending?.then) pending.then(resolve, reject)
  })
}

/**
 * Starts downloading a clip without decoding it, so opening its game later
 * doesn't wait on the network. Decoding is left until a player asks: it is
 * quick, and the decoded copy is ten times the size.
 */
export function prefetchClip(url) {
  if (!url || !hasWebAudio() || decoded.has(url) || fetched.has(url)) return
  const bytes = fetchClip(url)
  bytes.catch(() => { if (fetched.get(url) === bytes) fetched.delete(url) })
  keep(fetched, url, bytes, FETCHED_KEEP)
}

/** The decoded clip, from memory if it is still held. */
export function loadClip(url) {
  const hit = decoded.get(url)
  if (hit) {
    keep(decoded, url, hit, DECODED_KEEP)
    return hit
  }
  const c = getContext()
  if (!c || !url) return Promise.reject(new Error('Web Audio is not available'))
  const bytes = fetched.get(url) || fetchClip(url)
  // Decoding takes the bytes over, so they can't be decoded a second time.
  fetched.delete(url)
  const buffer = bytes.then((b) => decode(c, b))
  buffer.catch(() => { if (decoded.get(url) === buffer) decoded.delete(url) })
  keep(decoded, url, buffer, DECODED_KEEP)
  return buffer
}

// ================================
// VOICES
// ================================
//
// A voice is one player's hold on one clip. Both kinds answer the same calls,
// so the player never needs to know which one it has:
//   play(from, until)  start at `from` and stop at `until`, both in seconds;
//                      resolves false if the sound was refused
//   pause()            stop, remembering where
//   park(t)            move the paused position
//   extend(until)      let a clip that is already playing run further
//   position()         the moment of the clip being heard right now
//   onEnd              called when a clip plays through to its stop
//   onInterrupt        called when something other than the player stops it

function createAnalyser(c) {
  const analyser = c.createAnalyser()
  // 512 bins at ~43Hz each. Coarser than this and the lowest bars, where a log
  // scale wants the most detail, all land on the same bin and move as one.
  analyser.fftSize = 1024
  // Enough smoothing to stop single-frame jitter, little enough to still land
  // on the beat rather than trailing along behind it.
  analyser.smoothingTimeConstant = 0.6
  // The defaults (-100/-30 dB) put a music mix near the bottom of the range,
  // where the bars barely move. The ceiling is kept well clear of where bass
  // actually sits: clip it here and every low bin returns a flat 255, losing the
  // difference between loud and very loud before anything downstream can use it.
  analyser.minDecibels = -85
  analyser.maxDecibels = -18
  return analyser
}

function release(node) {
  try { node.source.disconnect() } catch { /* already gone */ }
  try { node.gain.disconnect() } catch { /* already gone */ }
}

export class BufferVoice {
  constructor(buffer, context = getContext()) {
    this.ctx = context
    this.buffer = buffer
    this.duration = buffer.duration
    this.ready = Promise.resolve()
    this.analyser = createAnalyser(context)
    this.analyser.connect(context.destination)
    this.node = null
    this.startedAt = 0
    this.from = 0
    this.until = 0
    this.parked = 0
    // Bumped by every play and pause, so a play still waiting on the context
    // can tell it has been overtaken and stay quiet.
    this.token = 0
    this.onEnd = null
    this.onInterrupt = null
    // A call, Siri, or the app going to the background takes the context away
    // mid-clip. Stop where it froze rather than carrying on silently.
    this.watch = () => {
      if (this.node && this.ctx.state !== 'running') this.interrupt()
    }
    context.addEventListener?.('statechange', this.watch)
  }

  get playing() {
    return Boolean(this.node)
  }

  async play(from, until) {
    const token = ++this.token
    const c = this.ctx
    if (c.state !== 'running') {
      // Inside a tap this wakes the context; outside one it may not, and then
      // the clip waits for a tap of its own rather than starting whenever some
      // unrelated tap happens to wake it.
      primeAudioContext()
      const running = await whenRunning(c, 800)
      if (!running || token !== this.token) return false
    }
    return this.start(from, until)
  }

  start(from, until) {
    this.halt()
    const end = Math.min(until ?? Infinity, this.duration)
    const begin = Math.min(Math.max(from || 0, 0), end)
    const length = end - begin
    if (length < 0.002) return false
    const at = this.ctx.currentTime + LEAD
    this.node = this.connect(at, begin, length, true)
    this.startedAt = at
    this.from = begin
    this.until = end
    return true
  }

  connect(at, offset, length, fadeIn) {
    const c = this.ctx
    const source = c.createBufferSource()
    source.buffer = this.buffer
    const gain = c.createGain()
    source.connect(gain)
    gain.connect(this.analyser)
    const level = gain.gain
    const fade = Math.min(FADE, length / 3)
    if (fadeIn) {
      level.setValueAtTime(0, at)
      level.linearRampToValueAtTime(1, at + fade)
    } else {
      level.setValueAtTime(1, at)
    }
    level.setValueAtTime(1, at + length - fade)
    level.linearRampToValueAtTime(0, at + length)
    // The stop is part of the start: the clip is exactly `length` long however
    // busy the page is when it gets there.
    source.start(at, offset, length)
    const node = { source, gain, drain: null }
    source.onended = () => this.ended(node)
    return node
  }

  ended(node) {
    if (this.node !== node || node.drain) return
    // The audio thread is done with the clip, but the speaker still has the
    // last of it in hand, a fifth of a second of it over Bluetooth. Report the
    // end once that has played out, so the playhead doesn't head home while
    // the clip can still be heard.
    const lag = Math.min(0.5, Math.max(0, this.ctx.currentTime - heardTime(this.ctx)))
    node.drain = setTimeout(() => {
      if (this.node !== node) return
      this.node = null
      this.parked = this.until
      release(node)
      this.onEnd?.()
    }, lag * 1000)
  }

  pause() {
    this.token++
    if (!this.node) return
    this.parked = this.position()
    this.halt()
  }

  park(t) {
    this.parked = Math.min(Math.max(t || 0, 0), this.duration)
  }

  /** Stops whatever is sounding with a short fade, leaving `parked` alone. */
  halt() {
    const node = this.node
    if (!node) return
    this.node = null
    clearTimeout(node.drain)
    node.source.onended = null
    const now = this.ctx.currentTime
    try {
      node.gain.gain.cancelScheduledValues(now)
      node.gain.gain.setTargetAtTime(0, now, FADE / 3)
      node.source.stop(now + FADE * 3)
    } catch {
      // It had already stopped on its own.
    }
    setTimeout(() => release(node), 250)
  }

  extend(until) {
    const node = this.node
    if (!node || node.drain) return
    const end = Math.min(until ?? Infinity, this.duration)
    if (end <= this.until + 0.001) return
    const c = this.ctx
    const at = c.currentTime + LEAD
    const offset = this.from + (at - this.startedAt)
    // Its fade-out has already begun: let it finish, and the longer clip is
    // there for the next play.
    if (offset >= this.until - FADE * 2) return
    // A second source picks up at the very sample the first would have played
    // at `at`, and the first stops there, so the hand-over is seamless.
    const next = this.connect(at, offset, end - offset, false)
    node.source.onended = null
    try { node.source.stop(at) } catch { /* already stopped */ }
    setTimeout(() => release(node), (at - c.currentTime) * 1000 + 250)
    this.node = next
    this.startedAt = at
    this.from = offset
    this.until = end
  }

  position() {
    if (!this.node) return this.parked
    const elapsed = heardTime(this.ctx) - this.startedAt
    return Math.min(this.until, this.from + Math.max(0, elapsed))
  }

  interrupt() {
    if (!this.node) return
    this.pause()
    this.onInterrupt?.()
  }

  dispose() {
    this.token++
    this.halt()
    this.ctx.removeEventListener?.('statechange', this.watch)
    this.onEnd = null
    this.onInterrupt = null
    const analyser = this.analyser
    setTimeout(() => { try { analyser.disconnect() } catch { /* already gone */ } }, 300)
  }
}

/**
 * The fallback: a plain element, played the way the player always did. Nothing
 * is routed through Web Audio, so the visualizer runs its stand-in animation.
 */
export class ElementVoice {
  constructor(src) {
    const el = new Audio()
    el.preload = 'auto'
    el.src = src
    this.el = el
    this.analyser = null
    this.parked = 0
    this.until = Infinity
    this.token = 0
    this.active = false
    this.onEnd = null
    this.onInterrupt = null

    this.handlePause = () => {
      // Paused by something other than the player: the system, the lock screen.
      if (!this.active) return
      this.active = false
      this.parked = el.currentTime
      this.onInterrupt?.()
    }
    this.handleEnded = () => {
      if (!this.active) return
      this.active = false
      this.parked = el.currentTime
      this.onEnd?.()
    }
    el.addEventListener('pause', this.handlePause)
    el.addEventListener('ended', this.handleEnded)

    // Not waited on before the voice is handed over: iOS may not load anything
    // until the first play, and a player held back for it would never start.
    this.ready = new Promise((resolve, reject) => {
      const done = () => { cleanup(); resolve() }
      const fail = () => { cleanup(); reject(new Error('Clip failed to load')) }
      function cleanup() {
        el.removeEventListener('loadedmetadata', done)
        el.removeEventListener('error', fail)
      }
      el.addEventListener('loadedmetadata', done)
      el.addEventListener('error', fail)
    })
  }

  get duration() {
    return this.el.duration
  }

  get playing() {
    return this.active
  }

  async play(from, until) {
    const token = ++this.token
    const el = this.el
    this.until = until ?? Infinity
    if (Math.abs(el.currentTime - from) > 0.02) el.currentTime = from
    this.active = true
    try {
      await el.play()
    } catch {
      if (token === this.token) this.active = false
      return false
    }
    return token === this.token
  }

  pause() {
    this.token++
    this.active = false
    this.parked = this.el.currentTime
    this.el.pause()
  }

  park(t) {
    this.parked = Math.max(t || 0, 0)
    // Quiet, so the seek is safe, and done now so it has landed by the next play.
    this.el.currentTime = this.parked
  }

  extend(until) {
    this.until = until ?? Infinity
  }

  position() {
    if (!this.active) return this.parked
    return Math.min(this.el.currentTime, this.until)
  }

  dispose() {
    this.token++
    this.active = false
    const el = this.el
    el.removeEventListener('pause', this.handlePause)
    el.removeEventListener('ended', this.handleEnded)
    el.pause()
    el.removeAttribute('src')
    el.load()
    this.onEnd = null
    this.onInterrupt = null
  }
}

/**
 * A voice for this clip: decoded when possible, an element when not. The
 * element's own `ready` says whether it loaded.
 */
export async function openClip(src) {
  try {
    const buffer = await loadClip(src)
    return new BufferVoice(buffer)
  } catch {
    return new ElementVoice(src)
  }
}
