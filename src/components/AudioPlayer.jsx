import { useState, useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react'
import { armAudioContext, primeAudioContext } from '../lib/audioAnalyser'
import { ONE_BAR_SILHOUETTE } from './GameGlyph'
import { useAudioBars } from '../hooks/useAudioBars'
import './AudioPlayer.css'

// One bar plus its gap. The count follows the card's width from this rather than
// being fixed: seven bars stretched over a phone are wider than they are tall,
// which rounds them into dots instead of bars.
const WAVE_SLOT_PX = 16
const WAVE_MIN_BARS = 8
const WAVE_MAX_BARS = 64

/**
 * The One Bar symbol resampled to however many bars fit. Its seven heights are
 * the control points, read across at whatever resolution the card allows, so the
 * player at rest still carries the game's shape rather than an unrelated one.
 */
function restingScales(count) {
  const last = ONE_BAR_SILHOUETTE.length - 1
  const sampled = Array.from({ length: count }, (_, i) => {
    const at = count > 1 ? (i / (count - 1)) * last : 0
    const lo = Math.min(Math.floor(at), last - 1)
    const blend = at - lo
    return ONE_BAR_SILHOUETTE[lo] * (1 - blend) + ONE_BAR_SILHOUETTE[lo + 1] * blend
  })
  // Re-normalised rather than divided by the symbol's own peak: unless a bar
  // lands exactly on the tallest point, resampling misses it, and the shape
  // would sit slightly shorter at some widths than others.
  const peak = Math.max(...sampled, 1)
  return sampled.map((h) => h / peak)
}

/** Stable per-bar jitter, so the idle animation never visibly repeats. */
function scatter(i, salt) {
  const x = Math.sin((i + 1) * salt) * 10000
  return x - Math.floor(x)
}

// Owned here rather than in CSS because the scrubber's width has to account for
// the gaps to line up with the segment boundaries.
const SEGMENT_GAP = 3
const EPS = 1e-6

// How long the playhead takes to travel back to the start when a clip finishes.
// The further it has to come, the quicker it goes: a full bar sweeping home over
// the same span a sliver gets would drag, and by the last stages the trip is
// something you have already watched five times.
const RETREAT_SLOW_MS = 260
const RETREAT_FAST_MS = 110

// Segments are laid out on a stylised scale, not in real seconds. In seconds the
// first two guesses each buy the same half-second, so they render as twin blocks,
// and every concave rescaling of the real timings makes the second segment
// *smaller* than the first, which reads worse still. Giving each stage a fixed
// step more room than the one before is the only arrangement that rises the
// whole way, and it has a second benefit: a half-second clip sweeps a visible
// segment instead of nudging the playhead two percent of the bar.
const SEGMENT_GROWTH = 1.45

/** Where a moment in the audio sits on the bar, 0-1. The bar is piecewise
 *  linear: even pace inside a segment, changing pace at each guess boundary. */
function timeToBar(segments, t) {
  const last = segments[segments.length - 1]
  for (const seg of segments) {
    if (t < seg.end || seg === last) {
      const within = (t - seg.start) / (seg.end - seg.start)
      return seg.offset + seg.width * Math.min(Math.max(within, 0), 1)
    }
  }
  return 1
}

/** The inverse, for turning a drag back into a seek. */
function barToTime(segments, x) {
  const last = segments[segments.length - 1]
  for (const seg of segments) {
    if (x < seg.offset + seg.width || seg === last) {
      const within = (x - seg.offset) / seg.width
      return seg.start + (seg.end - seg.start) * Math.min(Math.max(within, 0), 1)
    }
  }
  return last.end
}

const AudioPlayer = forwardRef(function AudioPlayer({ src, maxDuration, trackSpan, segmentStops, label, onPlay, autoplay }, ref) {
  const audioRef = useRef(null)
  const waveRef = useRef(null)
  const [barCount, setBarCount] = useState(WAVE_MIN_BARS)
  const [playing, setPlaying] = useState(false)
  // Reading the audio back requires crossOrigin, which a host that sends no CORS
  // headers refuses outright. Start optimistic, and drop it if the load fails:
  // hearing the clip matters, watching it does not.
  const [corsBlocked, setCorsBlocked] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const limit = maxDuration || Infinity

  useImperativeHandle(ref, () => ({
    pause() {
      if (audioRef.current) audioRef.current.pause()
    },
    play() {
      const audio = audioRef.current
      if (!audio) return Promise.resolve()
      onPlay?.()
      return audio.play() ?? Promise.resolve()
    },
    // Play from the top regardless of where the clip was left. Used when more
    // audio has just been unlocked and the point is to hear it from the start.
    restart() {
      const audio = audioRef.current
      if (!audio) return Promise.resolve()
      audio.currentTime = 0
      setCurrentTime(0)
      onPlay?.()
      return audio.play() ?? Promise.resolve()
    },
  }))

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onLoaded = () => setDuration(audio.duration)
    const onTime = () => {
      setCurrentTime(audio.currentTime)
      if (maxDuration && audio.currentTime >= maxDuration) {
        audio.pause()
        audio.currentTime = 0
        setCurrentTime(0)
      }
    }
    const onEnded = () => setCurrentTime(0)
    const onPlayEvent = () => setPlaying(true)
    const onPauseEvent = () => setPlaying(false)

    const onError = () => {
      if (audio.crossOrigin) setCorsBlocked(true)
    }

    audio.addEventListener('error', onError)
    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlayEvent)
    audio.addEventListener('pause', onPauseEvent)
    return () => {
      audio.removeEventListener('error', onError)
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlayEvent)
      audio.removeEventListener('pause', onPauseEvent)
    }
  }, [maxDuration, src])

  // The first tap anywhere starts the audio context; Safari accepts nothing else.
  useEffect(() => { armAudioContext() }, [])

  // Bar count follows the card, so the same slot width holds on a phone and on a
  // wide window instead of the bars stretching to fill.
  useEffect(() => {
    const wave = waveRef.current
    if (!wave) return
    const measure = () => {
      const width = wave.getBoundingClientRect().width
      if (!width) return
      const fits = Math.round(width / WAVE_SLOT_PX)
      setBarCount(Math.max(WAVE_MIN_BARS, Math.min(WAVE_MAX_BARS, fits)))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(wave)
    return () => observer.disconnect()
  }, [])

  useAudioBars(audioRef, waveRef, playing, barCount)

  // Fetching again without crossOrigin, once, after a load that it refused.
  useEffect(() => {
    if (corsBlocked) audioRef.current?.load()
  }, [corsBlocked])

  useEffect(() => {
    setCorsBlocked(false)
    setCurrentTime(0)
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = 0
    audio.pause()

    if (!autoplay || !src) return

    onPlay?.()
    const p = audio.play()
    if (p?.catch) p.catch(() => {})
  }, [src, autoplay])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    // A real tap is the only thing Safari will start the audio context on, and
    // this is the most reliable one the player gets.
    primeAudioContext()
    if (playing) {
      audio.pause()
    } else {
      audio.play()
      onPlay?.()
    }
  }

  // What can actually be heard right now.
  const playable = maxDuration || duration

  // `trackSpan` lets the bar stand for the whole length the clip can grow to
  // rather than just the part that plays, so the locked remainder stays on
  // screen instead of the bar rescaling to look full at every stage. Capped by
  // the real audio so the bar never promises more than exists.
  const barTotal = trackSpan ? Math.min(trackSpan, duration || Infinity) : playable
  const hasBar = barTotal > 0 && isFinite(barTotal)

  // `segmentStops` are cumulative points inside the span where the bar is cut.
  // One Bar passes the seconds each guess unlocks, so the timeline *is* the
  // guess ladder: one control to read instead of two rows that must agree.
  const segments = useMemo(() => {
    if (!segmentStops?.length || !hasBar) return null
    const cuts = []
    let prev = 0
    for (const stop of segmentStops) {
      const end = Math.min(stop, barTotal)
      if (end > prev) cuts.push({ start: prev, end })
      prev = end
      if (prev >= barTotal) break
    }
    if (!cuts.length) return null

    const weights = cuts.map((_, i) => SEGMENT_GROWTH ** i)
    const total = weights.reduce((a, b) => a + b, 0)
    let offset = 0
    return cuts.map((cut, i) => {
      const width = weights[i] / total
      const seg = { ...cut, width, offset }
      offset += width
      return seg
    })
  }, [segmentStops, hasBar, barTotal])

  const prevTimeRef = useRef(0)
  const lastHeardRef = useRef(0)
  const wentBack = currentTime < prevTimeRef.current - EPS

  // A finished clip rewinds to zero. Every filled segment would otherwise empty
  // on its own clock at the same moment, several playheads retreating at once
  // rather than one going home, so the emptying is sequenced right to left. A
  // backwards drag still lands instantly, to stay under the finger.
  //
  // This has to be held, not derived from the previous render: pausing at the
  // cutoff queues its own event, so a second render arrives a few milliseconds
  // in with the time already zero. Deriving it there would read "not rewinding
  // any more", drop the stagger mid-sweep, and collapse the lot at once.
  const retreating = currentTime <= EPS && lastHeardRef.current > EPS

  useEffect(() => {
    prevTimeRef.current = currentTime
    if (currentTime > EPS) lastHeardRef.current = currentTime
  }, [currentTime])

  // One coordinate system for the bar whether or not it is segmented: 0-1 across
  // the whole track, so the fill, the scrubber and the seek all speak it.
  const toBar = (t) => (segments ? timeToBar(segments, t) : hasBar ? Math.min(t / barTotal, 1) : 0)
  const fromBar = (x) => (segments ? barToTime(segments, x) : x * barTotal)

  const progress = toBar(currentTime)
  const unlockedBar = hasBar ? toBar(playable) : 1
  const unlockedCount = segments
    ? segments.filter((seg) => seg.end <= playable + EPS).length
    : 0

  // Percentages measure the bar including its gaps, so a plain percentage would
  // drift from the segment edge it is meant to stop at. Take the gaps out, scale
  // what is left, then add back the gaps that fall inside the unlocked run.
  const scrubWidth = segments
    ? `calc((100% - ${(segments.length - 1) * SEGMENT_GAP}px) * ${unlockedBar} + ${Math.max(0, unlockedCount - 1) * SEGMENT_GAP}px)`
    : `${unlockedBar * 100}%`

  // Where the playhead is retreating from, in bar coordinates.
  const retreatFrom = retreating ? toBar(lastHeardRef.current) : 0
  const retreatMs = RETREAT_SLOW_MS -
    (RETREAT_SLOW_MS - RETREAT_FAST_MS) * Math.min(Math.max(retreatFrom, 0), 1)

  // Each piece of fill empties during the slice of the trip when the playhead is
  // crossing it: it waits out everything to its right, then takes a share of the
  // time matching its own width. Linear, so the pieces join into one motion
  // instead of easing separately and stuttering at every boundary.
  function fillTransition(offset, width) {
    if (retreating && retreatFrom > EPS) {
      const filled = Math.max(0, Math.min(offset + width, retreatFrom) - offset)
      // Round the two edge times rather than the duration: neighbours then share
      // an identical boundary and the sweep has no seam between them.
      const at = (x) => Math.max(0, Math.round(((retreatFrom - x) / retreatFrom) * retreatMs))
      const start = at(offset + filled)
      return `width ${at(offset) - start}ms linear ${start}ms`
    }
    // Any other jump backwards, such as a drag, should not animate at all.
    return wentBack ? 'none' : undefined
  }

  function handleSeek(event) {
    const audio = audioRef.current
    if (!audio || !isFinite(playable) || playable <= 0) return
    // The input runs in bar percent, not seconds, and on a segmented bar those are
    // no longer the same thing, and only this keeps the thumb under the finger.
    const nextTime = Math.min(fromBar(Number(event.target.value) / 100), playable)
    audio.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  function fmt(s) {
    if (!isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  return (
    <div className="audio-player">
      {/* Behind everything, spanning the card: it only says "sound is coming out
          right now", so it stays mounted and fades rather than popping in and
          out. Paused animations cost nothing, so an idle player is free. */}
      <span
        ref={waveRef}
        className={`audio-player__wave${playing ? ' audio-player__wave--active' : ''}`}
        aria-hidden="true"
      >
        {restingScales(barCount).map((rest, i) => (
          <span
            key={i}
            className="audio-player__wave-bar"
            style={{
              '--rest': rest.toFixed(3),
              animationDuration: `${(0.75 + scatter(i, 12.9898) * 0.7).toFixed(2)}s`,
              animationDelay: `${(scatter(i, 78.233) * 0.45).toFixed(2)}s`,
            }}
          />
        ))}
      </span>

      {label && <p className="audio-player__label">{label}</p>}

      {/* Keyed by src so each clip gets its own element. Once an element is
          routed into the audio graph it can never be un-routed, and dropping
          crossOrigin on one that is already connected would taint it and play
          silence. A fresh element per source keeps that decision reversible. */}
      <audio
        key={src}
        ref={audioRef}
        src={src}
        crossOrigin={corsBlocked ? undefined : 'anonymous'}
        preload="auto"
        playsInline
      />

      <div className="audio-player__controls">
        <button
          onClick={togglePlay}
          className={`audio-player__play-btn btn-press audio-play-btn${playing ? ' playing' : ''}`}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg width="12" height="14" viewBox="0 0 12 14" fill="#0f0f0f">
              <rect x="0" y="0" width="4" height="14" rx="1"/>
              <rect x="8" y="0" width="4" height="14" rx="1"/>
            </svg>
          ) : (
            <svg width="13" height="14" viewBox="0 0 13 14" fill="#0f0f0f" style={{ marginLeft: '1px' }}>
              <path d="M1 1L12 7L1 13V1Z"/>
            </svg>
          )}
        </button>

        <div className="audio-player__progress">
          <label
            className={`audio-player__track${segments ? ' audio-player__track--segmented' : ''}`}
            style={segments ? { gap: `${SEGMENT_GAP}px` } : undefined}
            aria-label="Audio position"
          >
            {segments ? segments.map((seg, i) => {
              const span = seg.end - seg.start
              const played = Math.min(Math.max((currentTime - seg.start) / span, 0), 1)
              return (
                <span
                  key={i}
                  className={`audio-player__segment${seg.end <= playable + EPS ? ' audio-player__segment--unlocked' : ''}`}
                  style={{ flexGrow: seg.width }}
                >
                  <span
                    className="audio-player__segment-fill"
                    style={{ width: `${played * 100}%`, transition: fillTransition(seg.offset, seg.width) }}
                  />
                </span>
              )
            }) : (
              <>
                {trackSpan ? (
                  <span
                    className="audio-player__unlocked"
                    style={{ width: `${unlockedRatio * 100}%` }}
                  />
                ) : null}
                <span
                  className="audio-player__fill"
                  style={{ width: `${progress * 100}%`, transition: fillTransition(0, 1) }}
                />
              </>
            )}
            {/* Narrowed to the unlocked stretch: dragging past it would seek
                into audio that can't play, and the thumb would sit nowhere
                near the finger. */}
            <input
              className="audio-player__scrubber"
              style={{ width: scrubWidth }}
              type="range"
              min="0"
              max={playable > 0 && isFinite(playable) ? unlockedBar * 100 : 0}
              step="0.5"
              value={Math.min(progress, unlockedBar) * 100}
              aria-valuetext={fmt(currentTime)}
              onChange={handleSeek}
              disabled={!src || !isFinite(playable) || playable <= 0}
            />
          </label>
          <div className="audio-player__times">
            <span className="audio-player__time">{fmt(currentTime)}</span>
            <span className="audio-player__time audio-player__time--total">
              {hasBar ? fmt(barTotal) : '--:--'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
})

export default AudioPlayer
