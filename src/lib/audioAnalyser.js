// Real levels for the waveform, read off the audio as it plays.
//
// Web Audio is one-way and unforgiving: the moment an element is routed into a
// graph, its sound only ever comes out through that graph. Two things then
// produce silence rather than an error —
//   1. a suspended AudioContext (Safari starts every context suspended and only
//      a user gesture can start one), and
//   2. media the page can't read cross-origin, which the spec says the source
//      node must output as silence.
// Both would take the audio out of a game that is entirely about listening, so
// nothing is connected until both are ruled out, and every failure path leaves
// the element untouched and playing on its own.

let ctx = null
let armed = false
// createMediaElementSource may be called only once per element.
const connected = new WeakMap()

function getContext() {
  if (ctx) return ctx
  const Ctor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    return null
  }
  return ctx
}

/** Start the context from a real user gesture — the only thing Safari accepts. */
export function primeAudioContext() {
  const c = getContext()
  if (c?.state === 'suspended') c.resume().catch(() => {})
}

/** One shared listener: the first tap anywhere in the app starts the context. */
export function armAudioContext() {
  if (armed || typeof document === 'undefined') return
  armed = true
  const start = () => primeAudioContext()
  document.addEventListener('pointerdown', start, { once: true, passive: true })
  document.addEventListener('touchend', start, { once: true, passive: true })
}

/**
 * An AnalyserNode for this element, or null when it isn't safe to connect one.
 * Null is the normal, expected answer — callers fall back to the canned
 * animation and the audio is never touched.
 */
export function getAnalyser(el) {
  if (!el) return null
  const existing = connected.get(el)
  if (existing) return existing

  const c = getContext()
  // A suspended graph would swallow the audio, so wait until it is actually running.
  if (!c || c.state !== 'running') return null
  // And only ever connect media we know loaded cross-origin readable.
  if (el.crossOrigin !== 'anonymous') return null

  try {
    const source = c.createMediaElementSource(el)
    const analyser = c.createAnalyser()
    analyser.fftSize = 64
    analyser.smoothingTimeConstant = 0.75
    source.connect(analyser)
    analyser.connect(c.destination)
    connected.set(el, analyser)
    return analyser
  } catch {
    return null
  }
}

/** True once this element is routed through the graph and can't be un-routed. */
export function isConnected(el) {
  return Boolean(el && connected.has(el))
}
