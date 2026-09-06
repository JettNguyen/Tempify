// Real levels for the waveform, read off the audio as it plays.
//
// Web Audio is one-way and unforgiving: the moment an element is routed into a
// graph, its sound only ever comes out through that graph. Two things then
// produce silence rather than an error:
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

/** Start the context from a real user gesture, the only thing Safari accepts. */
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
 * Null is the normal, expected answer: callers fall back to the canned
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
    // 512 bins at ~43Hz each. Coarser than this and the lowest bars, where a
    // log scale wants the most detail, all land on the same bin and move as one.
    analyser.fftSize = 1024
    // Enough smoothing to stop single-frame jitter, little enough to still land
    // on the beat rather than trailing along behind it.
    analyser.smoothingTimeConstant = 0.6
    // The defaults (-100/-30 dB) put a music mix near the bottom of the range,
    // where the bars barely move. The ceiling is kept well clear of where bass
    // actually sits: clip it here and every low bin returns a flat 255, losing
    // the difference between loud and very loud before anything downstream can
    // do something about it.
    analyser.minDecibels = -85
    analyser.maxDecibels = -18
    source.connect(analyser)
    analyser.connect(c.destination)
    connected.set(el, analyser)
    return analyser
  } catch {
    return null
  }
}

/**
 * Calls back whenever the context wakes or sleeps. Resuming is asynchronous, so
 * the first play almost always asks for an analyser while the context is still
 * suspended; without this the answer stays "no" for that whole clip and the
 * canned animation stands in for audio that is playing perfectly well.
 */
export function onContextStateChange(fn) {
  const c = getContext()
  if (!c) return () => {}
  c.addEventListener('statechange', fn)
  return () => c.removeEventListener('statechange', fn)
}

/** True once this element is routed through the graph and can't be un-routed. */
export function isConnected(el) {
  return Boolean(el && connected.has(el))
}
