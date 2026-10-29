import { useEffect, useRef } from 'react'
import { ONE_BAR_SILHOUETTE } from './GameGlyph'
import { createBandReader, synthBands, createBeatDetector, approach, SILENT } from '../lib/audioLevels'

// The stage behind each game's play button: that game's symbol from the home
// screen, moving with the clip. One Bar's bars, Hit or Miss's chart, Era's
// record and Cover or Not's two rings, so the screen you play on carries the
// tile you tapped to get there.
//
// Drawn on a canvas rather than as elements: every frame moves every part of
// it, and sixty style changes a second across a row of elements is work the
// phone has to lay out, where a canvas only repaints itself.

// A phone at 3x looks the same at 2x for shapes this simple, at under half the
// pixels to fill each frame.
const MAX_DPR = 2
// A band that is audible at all keeps enough height to stay taller than wide.
const FLOOR = 0.2

/** The One Bar symbol resampled to `count` bars, tallest at 1. */
function silhouette(count) {
  const last = ONE_BAR_SILHOUETTE.length - 1
  const sampled = Array.from({ length: count }, (_, i) => {
    const at = count > 1 ? (i / (count - 1)) * last : 0
    const lo = Math.min(Math.floor(at), last - 1)
    const blend = at - lo
    return ONE_BAR_SILHOUETTE[lo] * (1 - blend) + ONE_BAR_SILHOUETTE[lo + 1] * blend
  })
  // Re-normalised rather than divided by the symbol's own peak: unless a bar
  // lands exactly on the tallest point, resampling misses it.
  const peak = Math.max(...sampled, 1)
  return sampled.map((h) => h / peak)
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v))
}

function pill(g, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2))
  g.beginPath()
  g.moveTo(x + rad, y)
  g.arcTo(x + w, y, x + w, y + h, rad)
  g.arcTo(x + w, y + h, x, y + h, rad)
  g.arcTo(x, y + h, x, y, rad)
  g.arcTo(x, y, x + w, y, rad)
  g.closePath()
  g.fill()
}

// ================================
// THE KINDS
// ================================
//
// Each kind says how many bands it reads at a given width, where its bands sit
// at rest, how a live reading becomes a height, and how to draw a frame.

const KINDS = {
  // One Bar. Mirrored about the middle, the way the symbol is drawn.
  bars: {
    bands: (w) => clamp(Math.round(w / 16), 8, 64),
    rest: (n) => silhouette(n).map((h) => h * 0.55),
    live: (v) => (v < SILENT ? 0 : FLOOR + (1 - FLOOR) * Math.pow(v, 0.8)),
    draw: drawBars,
  },
  // The quiet version behind a small player: only there while it plays.
  backdrop: {
    bands: (w) => clamp(Math.round(w / 16), 8, 64),
    rest: (n) => silhouette(n),
    live: (v) => (v < SILENT ? 0 : FLOOR + (1 - FLOOR) * Math.pow(v, 0.8)),
    draw: drawBackdrop,
  },
  // Hit or Miss. Bars climbing from a baseline toward a Hot 100 line, with the
  // highest point each one reached left hanging for a moment: its peak.
  chart: {
    bands: (w) => clamp(Math.round(w / 15), 10, 40),
    rest: (n) => Array.from({ length: n }, (_, i) => 0.1 + 0.2 * (n > 1 ? i / (n - 1) : 0)),
    live: (v) => 0.05 + 0.95 * Math.pow(v, 0.85),
    draw: drawChart,
  },
  // Era. A record that spins up when the clip plays, the spectrum around its rim.
  record: {
    bands: () => 24,
    rest: (n) => new Array(n).fill(0.08),
    live: (v) => 0.06 + 0.94 * Math.pow(v, 0.9),
    draw: drawRecord,
  },
  // Cover or Not. The two overlapping circles, one breathing with the low end and
  // one with the top, throwing off a ring on each beat.
  rings: {
    bands: () => 16,
    rest: (n) => new Array(n).fill(0),
    live: (v) => v,
    draw: drawRings,
  },
}

function drawBars(g, w, h, s) {
  const n = s.levels.length
  const slot = w / n
  const bw = Math.max(2, slot * 0.5)
  const mid = h / 2
  g.fillStyle = s.color
  for (let i = 0; i < n; i++) {
    const level = s.levels[i]
    if (level <= 0.001) continue
    const bh = Math.max(bw, level * h * 0.82)
    // Brightest at the middle, under the play button, fading toward the edges,
    // so the sound reads as coming from the button.
    const fromMid = Math.abs((i + 0.5) / n - 0.5) * 2
    g.globalAlpha = (0.3 + 0.6 * s.activity) * (1 - 0.55 * Math.pow(fromMid, 1.4))
    pill(g, i * slot + (slot - bw) / 2, mid - bh / 2, bw, bh, bw / 2)
  }
  g.globalAlpha = 1
}

function drawBackdrop(g, w, h, s) {
  if (s.activity < 0.01) return
  const n = s.levels.length
  const slot = w / n
  const bw = Math.max(2, slot * 0.5)
  const mid = h / 2
  g.fillStyle = s.color
  // Solid colour kept this faint so the controls over it stay readable.
  g.globalAlpha = 0.11 * s.activity
  for (let i = 0; i < n; i++) {
    const level = s.levels[i]
    if (level <= 0.001) continue
    const bh = Math.max(bw, level * h * 0.82)
    pill(g, i * slot + (slot - bw) / 2, mid - bh / 2, bw, bh, bw / 2)
  }
  g.globalAlpha = 1
}

const CHART_LINE = 0.62

function drawChart(g, w, h, s) {
  const n = s.levels.length
  const top = 16
  const base = h - 12
  const room = base - top
  const slot = w / n
  const bw = Math.max(3, slot * 0.56)
  const lineY = base - room * CHART_LINE

  // The line a song has to cross to chart.
  g.strokeStyle = '#ffffff'
  g.globalAlpha = 0.2
  g.lineWidth = 1
  g.setLineDash?.([4, 5])
  g.beginPath()
  g.moveTo(0, Math.round(lineY) + 0.5)
  g.lineTo(w, Math.round(lineY) + 0.5)
  g.stroke()
  g.setLineDash?.([])
  g.globalAlpha = 0.42
  g.fillStyle = '#ffffff'
  g.font = '600 9px Inter, system-ui, sans-serif'
  g.textAlign = 'right'
  g.textBaseline = 'bottom'
  g.fillText('HOT 100', w - 8, Math.round(lineY) - 4)

  for (let i = 0; i < n; i++) {
    const level = s.levels[i]
    const x = i * slot + (slot - bw) / 2
    const bh = Math.max(3, level * room)
    const y = base - bh
    g.fillStyle = s.color
    // Under the line a bar is still climbing; over it, it has charted.
    g.globalAlpha = 0.28 + 0.24 * s.activity
    pill(g, x, Math.max(y, lineY), bw, base - Math.max(y, lineY), 2)
    if (y < lineY) {
      g.globalAlpha = 0.65 + 0.35 * s.activity
      pill(g, x, y, bw, lineY - y + 2, 2)
    }
    const peak = s.peaks[i]
    if (s.activity > 0.02 && peak > level + 0.02) {
      const py = base - peak * room
      g.fillStyle = py < lineY ? '#ffffff' : s.color
      g.globalAlpha = (py < lineY ? 0.8 : 0.6) * s.activity
      pill(g, x, py - 3, bw, 2.5, 1.25)
    }
  }

  g.globalAlpha = 0.12
  g.fillStyle = '#ffffff'
  g.fillRect(0, base + 2, w, 1)
  g.globalAlpha = 1
}

function recordGeometry(w, h) {
  const r = Math.min(h * 0.44, w * 0.3)
  return { cx: w / 2, cy: h / 2, r, label: r * 0.52 }
}

/** The disc itself never changes, so it is drawn once per size and stamped. */
function paintDisc(w, h, dpr) {
  const { cx, cy, r } = recordGeometry(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(w * dpr)
  canvas.height = Math.ceil(h * dpr)
  const g = canvas.getContext('2d')
  g.scale(dpr, dpr)
  g.fillStyle = '#0b0b0b'
  g.beginPath()
  g.arc(cx, cy, r, 0, Math.PI * 2)
  g.fill()
  // Grooves, alternating faintly so they read as cut rather than printed.
  g.lineWidth = 1
  let k = 0
  for (let gr = r * 0.97; gr > r * 0.58; gr -= 2.6) {
    g.strokeStyle = '#ffffff'
    g.globalAlpha = k++ % 3 === 0 ? 0.075 : 0.035
    g.beginPath()
    g.arc(cx, cy, gr, 0, Math.PI * 2)
    g.stroke()
  }
  // Two still highlights. They stay put while the label turns under them,
  // which is what makes the spin read as a spin.
  for (const start of [-0.95, 2.2]) {
    const sheen = g.createRadialGradient(cx, cy, r * 0.55, cx, cy, r)
    sheen.addColorStop(0, 'rgba(255,255,255,0)')
    sheen.addColorStop(0.6, 'rgba(255,255,255,0.07)')
    sheen.addColorStop(1, 'rgba(255,255,255,0)')
    g.globalAlpha = 1
    g.fillStyle = sheen
    g.beginPath()
    g.moveTo(cx, cy)
    g.arc(cx, cy, r, start, start + 0.5)
    g.closePath()
    g.fill()
  }
  g.globalAlpha = 0.18
  g.strokeStyle = '#ffffff'
  g.beginPath()
  g.arc(cx, cy, r - 0.5, 0, Math.PI * 2)
  g.stroke()
  return canvas
}

function drawRecord(g, w, h, s) {
  const { cx, cy, r, label } = recordGeometry(w, h)

  // The spectrum around the rim, mirrored so the record stays balanced.
  const n = s.levels.length
  const ticks = 72
  g.strokeStyle = s.color
  g.lineCap = 'round'
  g.lineWidth = 2.2
  for (let i = 0; i < ticks; i++) {
    const half = i < ticks / 2 ? i : ticks - 1 - i
    const band = Math.min(n - 1, Math.floor((half / (ticks / 2)) * n))
    const level = s.levels[band]
    const a = (i / ticks) * Math.PI * 2 - Math.PI / 2
    const inner = r + 5
    const outer = inner + 3 + level * r * 0.34
    g.globalAlpha = 0.22 + 0.7 * level * (0.4 + 0.6 * s.activity)
    g.beginPath()
    g.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner)
    g.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer)
    g.stroke()
  }
  g.globalAlpha = 1

  if (s.disc) g.drawImage(s.disc, 0, 0, w, h)

  // The label, in the game's colour, with marks that turn with the record.
  g.fillStyle = s.color
  g.beginPath()
  g.arc(cx, cy, label, 0, Math.PI * 2)
  g.fill()
  g.save()
  g.translate(cx, cy)
  g.rotate(s.angle)
  g.fillStyle = '#000000'
  g.globalAlpha = 0.28
  for (let i = 0; i < 3; i++) {
    const len = label * (0.5 - i * 0.1)
    pill(g, -len / 2, -label * (0.78 - i * 0.1), len, 2, 1)
  }
  g.globalAlpha = 0.5
  g.beginPath()
  g.arc(0, label * 0.84, 2.2, 0, Math.PI * 2)
  g.fill()
  g.restore()
  g.globalAlpha = 1
}

function drawRings(g, w, h, s) {
  const base = Math.min(h * 0.34, w * 0.22)
  const cy = h / 2
  const lx = w / 2 - base * 0.47
  const rx = w / 2 + base * 0.47
  const lr = base * (1 + 0.12 * s.low)
  const rr = base * (1 + 0.12 * s.high)

  // Where the two takes overlap, lit with how loud the clip is.
  g.save()
  g.beginPath()
  g.arc(lx, cy, lr, 0, Math.PI * 2)
  g.clip()
  g.fillStyle = s.color
  g.globalAlpha = 0.08 + 0.2 * s.energy * s.activity
  g.beginPath()
  g.arc(rx, cy, rr, 0, Math.PI * 2)
  g.fill()
  g.restore()

  g.strokeStyle = s.color
  for (const ring of s.ripples) {
    const p = ring.age / ring.life
    const radius = (ring.side ? rr : lr) * (1 + 0.65 * p)
    g.globalAlpha = 0.45 * (1 - p) * (1 - p)
    g.lineWidth = 2.5 * (1 - p) + 0.5
    g.beginPath()
    g.arc(ring.side ? rx : lx, cy, radius, 0, Math.PI * 2)
    g.stroke()
  }

  g.lineWidth = 4
  g.globalAlpha = 0.45 + 0.5 * s.activity
  g.beginPath()
  g.arc(lx, cy, lr, 0, Math.PI * 2)
  g.stroke()
  g.beginPath()
  g.arc(rx, cy, rr, 0, Math.PI * 2)
  g.stroke()
  g.globalAlpha = 1
}

// ================================
// THE COMPONENT
// ================================

function reducedMotion() {
  return typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

/**
 * @param kind     bars | backdrop | chart | record | rings
 * @param playing  whether the clip is sounding
 * @param voiceRef the player's voice, read each frame for its analyser
 * @param stageRef an element to carry --glow and --beat, the clip's loudness and
 *                 its last beat, for the light and the play button around it
 */
export default function AudioVisual({ kind = 'bars', playing, voiceRef, stageRef, className }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const playingRef = useRef(playing)
  const renderRef = useRef(() => {})
  const kickRef = useRef(() => {})
  const spec = KINDS[kind] || KINDS.bars

  // Size, colour, and the bands for this width. Rebuilt on resize; the levels
  // carry over where the count allows so a resize mid-clip doesn't flash.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function layout() {
      const box = canvas.getBoundingClientRect()
      if (!box.width || !box.height) return
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      canvas.width = Math.round(box.width * dpr)
      canvas.height = Math.round(box.height * dpr)
      const n = spec.bands(box.width)
      const prev = stateRef.current
      const rest = spec.rest(n)
      const keepLevels = prev && prev.levels.length === n
      stateRef.current = {
        w: box.width,
        h: box.height,
        dpr,
        color: getComputedStyle(canvas).getPropertyValue('--game-color').trim() || '#f59e0b',
        rest,
        raw: new Float32Array(n),
        levels: keepLevels ? prev.levels : Float32Array.from(rest),
        peaks: keepLevels ? prev.peaks : Float32Array.from(rest),
        holds: keepLevels ? prev.holds : new Float32Array(n),
        activity: prev?.activity ?? 0,
        energy: prev?.energy ?? 0,
        low: prev?.low ?? 0,
        high: prev?.high ?? 0,
        beat: prev?.beat ?? 0,
        angle: prev?.angle ?? 0,
        spin: prev?.spin ?? 0,
        ripples: prev?.ripples ?? [],
        side: prev?.side ?? 0,
        reader: null,
        readerFor: null,
        detect: prev?.detect ?? createBeatDetector(),
        disc: kind === 'record' ? paintDisc(box.width, box.height, dpr) : null,
      }
      render()
      kickRef.current()
    }

    function render() {
      const s = stateRef.current
      const g = canvas.getContext('2d')
      if (!s || !g) return
      g.setTransform(s.dpr, 0, 0, s.dpr, 0, 0)
      g.clearRect(0, 0, s.w, s.h)
      spec.draw(g, s.w, s.h, s)
    }
    renderRef.current = render

    layout()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', layout)
      return () => window.removeEventListener('resize', layout)
    }
    const observer = new ResizeObserver(layout)
    observer.observe(canvas)
    return () => observer.disconnect()
    // spec follows kind, which a player never changes.
  }, [kind])

  useEffect(() => {
    playingRef.current = playing
    const canvas = canvasRef.current
    if (!canvas) return
    const stage = stageRef?.current
    if (reducedMotion()) {
      // Someone who asked for less motion did not ask for a live equaliser.
      // The stage holds still in its resting shape, playing or not.
      stage?.style.setProperty('--glow', playing ? '0.5' : '0')
      return
    }

    let frame = 0
    let last = 0
    let shownGlow = -1
    let shownBeat = -1

    function step(now) {
      const s = stateRef.current
      if (!s) return
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
      last = now
      const live = playingRef.current
      const n = s.levels.length

      if (live) {
        const analyser = voiceRef?.current?.analyser
        if (analyser) {
          if (s.readerFor !== analyser) {
            s.reader = createBandReader(analyser, n)
            s.readerFor = analyser
          }
          s.reader(s.raw)
        } else {
          synthBands(s.raw, now / 1000)
        }
      }

      s.activity = approach(s.activity, live ? 1 : 0, 0.08, dt)
      let sum = 0
      let low = 0
      let high = 0
      const lowCount = Math.max(1, Math.round(n * 0.25))
      for (let i = 0; i < n; i++) {
        const target = live ? spec.live(s.raw[i]) : s.rest[i]
        const cur = s.levels[i]
        // Quick to rise, slower to fall: a hit lands on the beat, and the decay
        // is what makes it look like sound rather than a flicker.
        s.levels[i] = approach(cur, target, target > cur ? 0.5 : 0.16, dt)
        const v = live ? s.raw[i] : 0
        sum += v
        if (i < lowCount) low += v
        if (i >= n - lowCount) high += v
        if (kind === 'chart') {
          if (s.levels[i] >= s.peaks[i]) {
            s.peaks[i] = s.levels[i]
            s.holds[i] = 0.4
          } else if (s.holds[i] > 0) {
            s.holds[i] -= dt
          } else {
            s.peaks[i] = Math.max(s.levels[i], s.peaks[i] - 0.45 * dt)
          }
        }
      }
      s.energy = approach(s.energy, sum / n, 0.2, dt)
      s.low = approach(s.low, low / lowCount, 0.35, dt)
      s.high = approach(s.high, Math.min(1, (high / lowCount) * 1.6), 0.35, dt)

      if (live && s.detect(low / lowCount, now)) {
        s.beat = 1
        if (kind === 'rings') {
          s.ripples.push({ side: s.side, age: 0, life: 0.95 })
          s.side = 1 - s.side
        }
      } else {
        s.beat = approach(s.beat, 0, 0.12, dt)
      }
      for (const ring of s.ripples) ring.age += dt
      s.ripples = s.ripples.filter((ring) => ring.age < ring.life)

      if (kind === 'record') {
        // A turntable takes a moment to come up to speed and to run down.
        s.spin = approach(s.spin, live ? 1 : 0, 0.045, dt)
        s.angle = (s.angle + dt * s.spin * Math.PI * 2 * (33.3 / 60)) % (Math.PI * 2)
      }

      renderRef.current()

      if (stage) {
        const glow = Math.round(Math.min(1, s.energy * 1.6 * s.activity) * 100) / 100
        const beat = Math.round(s.beat * s.activity * 100) / 100
        if (glow !== shownGlow) { stage.style.setProperty('--glow', String(glow)); shownGlow = glow }
        if (beat !== shownBeat) { stage.style.setProperty('--beat', String(beat)); shownBeat = beat }
      }

      let settled = !live && s.activity < 0.01 && s.ripples.length === 0 && s.spin < 0.003
      if (settled) {
        for (let i = 0; i < n; i++) {
          if (Math.abs(s.levels[i] - s.rest[i]) > 0.004 || (kind === 'chart' && Math.abs(s.peaks[i] - s.levels[i]) > 0.004)) {
            settled = false
            break
          }
        }
      }
      frame = settled ? 0 : requestAnimationFrame(step)
    }

    function kick() {
      if (!frame) frame = requestAnimationFrame(step)
    }
    kickRef.current = kick
    kick()
    return () => {
      cancelAnimationFrame(frame)
      frame = 0
      kickRef.current = () => {}
    }
  }, [playing, kind, voiceRef, stageRef])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
