import { useState, useRef, useEffect, useLayoutEffect, useMemo, forwardRef, useImperativeHandle } from 'react'
import { armAudioContext, primeAudioContext, openClip } from '../lib/audioEngine'
import { buildSegments, timeToBar, barToTime, barToPixel, pixelToBar } from '../lib/clipTimeline'
import AudioVisual from './AudioVisual'
import './AudioPlayer.css'

// Owned here rather than in CSS because the playhead's position has to account
// for the gaps to line up with the segment boundaries.
const SEGMENT_GAP = 3
const EPS = 1e-6
// Within this of the stop, a play starts from the top instead: a press of play
// on a finished clip means "again", not "the last few milliseconds".
const AT_END = 0.02
// How far a finger has to travel before a press on the bar counts as a drag
// and the sound goes quiet for it. Under this it is a tap: a jump.
const DRAG_SLOP = 4

// How long the playhead takes to travel back to the start when a clip finishes.
// The further it has to come, the quicker it goes: a full bar sweeping home over
// the same span a sliver gets would drag, and by the last stages the trip is
// something you have already watched five times.
const RETREAT_SLOW_MS = 260
const RETREAT_FAST_MS = 110

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v))
}

function fmt(s) {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

/** Spoken position: whole seconds read badly on a half-second clip. */
function speak(s) {
  return s < 60 ? `${(Math.round(s * 10) / 10).toFixed(1)} seconds` : fmt(s)
}

function reducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

/**
 * @param src            the clip
 * @param maxDuration    how much of it can be heard right now (One Bar)
 * @param trackSpan      how long the bar stands for, so the locked remainder
 *                       stays on screen rather than the bar rescaling each stage
 * @param segmentStops   cumulative seconds the bar is cut at (One Bar's ladder)
 * @param segmentLabels  what to write under each segment: { content, tone }
 * @param freshSegment   a segment that has just been unlocked, to light up
 * @param variant        'stage' for a game's main player; small otherwise
 * @param visual         what the stage draws: bars | chart | record | rings
 * @param children       drawn at the top of the stage, over the light
 */
const AudioPlayer = forwardRef(function AudioPlayer({
  src, maxDuration, trackSpan, segmentStops, segmentLabels, freshSegment,
  label, onPlay, autoplay, variant, visual = 'bars', children,
}, ref) {
  const stage = variant === 'stage'
  const voiceRef = useRef(null)
  const stageRef = useRef(null)
  const trackRef = useRef(null)
  const railRef = useRef(null)
  const fillRef = useRef(null)
  const fillRefs = useRef([])
  const thumbRef = useRef(null)
  const timeRef = useRef(null)

  const [status, setStatus] = useState('loading')
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  // A play asked for before the clip has arrived; it starts the moment it does.
  const [pending, setPending] = useState(false)
  const [scrubbing, setScrubbing] = useState(false)
  // Whether this clip has been heard at all, so the button can invite the first
  // press and then stop asking.
  const [heard, setHeard] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // What the handlers need to read, held in refs: they run from frame loops,
  // pointer events and the voice's own callbacks, all outside React's renders.
  const playingRef = useRef(false)
  const pendingRef = useRef(false)
  const maxRef = useRef(maxDuration)
  const durationRef = useRef(0)
  const autoplayRef = useRef(autoplay)
  const onPlayRef = useRef(onPlay)
  const posRef = useRef(0)
  const railWidthRef = useRef(0)
  const scrubRef = useRef(null)
  const retreatRef = useRef(0)
  const finishingRef = useRef(false)
  useEffect(() => {
    autoplayRef.current = autoplay
    onPlayRef.current = onPlay
  })

  // What can actually be heard right now.
  const playable = maxDuration || duration

  // `trackSpan` lets the bar stand for the whole length the clip can grow to
  // rather than just the part that plays. Capped by the real audio so the bar
  // never promises more than exists.
  const barTotal = trackSpan ? Math.min(trackSpan, duration || Infinity) : playable
  const hasBar = barTotal > 0 && isFinite(barTotal)

  // `segmentStops` are cumulative points inside the span where the bar is cut.
  // One Bar passes the seconds each guess unlocks, so the timeline *is* the
  // guess ladder: one control to read instead of two rows that must agree.
  const segments = useMemo(
    () => (hasBar ? buildSegments(segmentStops, barTotal) : null),
    [segmentStops, hasBar, barTotal],
  )
  const segmentsRef = useRef(segments)
  const barTotalRef = useRef(barTotal)
  segmentsRef.current = segments
  barTotalRef.current = barTotal

  const unlockedCount = segments ? segments.filter((seg) => seg.end <= playable + EPS).length : 0
  const canSeek = Boolean(src) && isFinite(playable) && playable > 0 && status !== 'error'

  // ================================
  // THE PLAYHEAD
  // ================================
  // Painted straight onto the elements rather than through state: it moves every
  // frame, and re-rendering the player sixty times a second to move a bar by a
  // pixel is the phone's time spent on nothing. React renders these elements
  // without the properties painted here, so a render never puts them back.

  /** Where the clip stops: its unlocked length, or its end. Infinity while an
   *  element fallback still doesn't know how long it is, which on iOS can be
   *  until the first play. */
  function limit() {
    const d = voiceRef.current?.duration
    const dur = isFinite(d) && d > 0 ? d : durationRef.current
    const max = maxRef.current
    if (max) return dur > 0 ? Math.min(max, dur) : max
    return dur > 0 ? dur : Infinity
  }

  function toBar(t) {
    const segs = segmentsRef.current
    if (segs) return timeToBar(segs, t)
    const total = barTotalRef.current
    return total > 0 && isFinite(total) ? clamp(t / total, 0, 1) : 0
  }

  function fromBar(x) {
    const segs = segmentsRef.current
    if (segs) return barToTime(segs, x)
    const total = barTotalRef.current
    return total > 0 && isFinite(total) ? x * total : 0
  }

  function paintBar(x, t) {
    const segs = segmentsRef.current
    if (segs) {
      segs.forEach((seg, i) => {
        const el = fillRefs.current[i]
        if (el) el.style.transform = `scaleX(${clamp((x - seg.offset) / seg.width, 0, 1)})`
      })
    } else if (fillRef.current) {
      fillRef.current.style.transform = `scaleX(${clamp(x, 0, 1)})`
    }
    if (thumbRef.current) {
      const px = barToPixel(segs, clamp(x, 0, 1), railWidthRef.current, SEGMENT_GAP)
      thumbRef.current.style.transform = `translateX(${px}px)`
    }
    const text = fmt(t)
    if (timeRef.current && timeRef.current.textContent !== text) timeRef.current.textContent = text
    const track = trackRef.current
    if (track) {
      const now = String(Math.round(t * 10) / 10)
      if (track.getAttribute('aria-valuenow') !== now) {
        track.setAttribute('aria-valuenow', now)
        track.setAttribute('aria-valuetext', speak(t))
      }
    }
    posRef.current = t
  }

  function paint(t) {
    paintBar(toBar(t), t)
  }

  function cancelRetreat() {
    if (retreatRef.current) cancelAnimationFrame(retreatRef.current)
    retreatRef.current = 0
  }

  // A finished clip goes back to the start, swept right to left across the bar
  // at an even pace in bar space, so it reads as one playhead going home rather
  // than each segment emptying on its own clock.
  function retreat(from) {
    cancelRetreat()
    if (from <= EPS || reducedMotion()) {
      paintBar(0, 0)
      return
    }
    const ms = RETREAT_SLOW_MS - (RETREAT_SLOW_MS - RETREAT_FAST_MS) * clamp(from, 0, 1)
    const began = performance.now()
    const step = (now) => {
      const p = Math.min(1, (now - began) / ms)
      if (!scrubRef.current) paintBar(from * (1 - p), 0)
      retreatRef.current = p < 1 ? requestAnimationFrame(step) : 0
    }
    retreatRef.current = requestAnimationFrame(step)
  }

  // ================================
  // PLAYING
  // ================================

  function setPlayingState(next) {
    playingRef.current = next
    setPlaying(next)
  }

  function setPendingState(next) {
    pendingRef.current = next
    setPending(next)
  }

  async function startPlayback(from, { optimistic = false } = {}) {
    cancelRetreat()
    const voice = voiceRef.current
    if (!voice) {
      // Not here yet. It starts as soon as it is.
      setPendingState(true)
      return
    }
    setPendingState(false)
    const end = limit()
    let at = from ?? voice.position()
    if (at >= end - AT_END) at = 0
    finishingRef.current = false
    // A tap gets the pause button at once; autoplay waits to find out whether
    // the sound was allowed, rather than flashing a pause button that undoes
    // itself a moment later.
    if (optimistic) setPlayingState(true)
    const ok = await voice.play(at, end)
    if (voiceRef.current !== voice) return
    if (!ok) {
      if (!voice.playing) setPlayingState(false)
      return
    }
    setPlayingState(true)
    setHeard(true)
    // Taken here rather than at each call site: however the clip came to be
    // playing, the other player on the screen still gets told to stop, and the
    // page still hears that the round has started.
    onPlayRef.current?.()
  }

  function pausePlayback() {
    setPendingState(false)
    const voice = voiceRef.current
    if (!voice) return
    voice.pause()
    setPlayingState(false)
    if (!scrubRef.current) paint(voice.position())
  }

  /** The clip played through to its stop. */
  function finish() {
    if (finishingRef.current) return
    finishingRef.current = true
    const voice = voiceRef.current
    voice?.pause()
    voice?.park(0)
    setPlayingState(false)
    if (!scrubRef.current) retreat(isFinite(limit()) ? toBar(limit()) : 1)
  }

  function interrupted() {
    const voice = voiceRef.current
    setPlayingState(false)
    if (voice && !scrubRef.current) paint(voice.position())
  }

  // Bound once per clip; these hold the latest versions for the voice to call.
  const finishRef = useRef(finish)
  const interruptRef = useRef(interrupted)
  const pauseRef = useRef(pausePlayback)
  const startRef = useRef(startPlayback)
  finishRef.current = finish
  interruptRef.current = interrupted
  pauseRef.current = pausePlayback
  startRef.current = startPlayback

  useImperativeHandle(ref, () => ({
    pause() {
      pauseRef.current()
    },
    play() {
      return startRef.current(undefined, { optimistic: true })
    },
    // Play from the top regardless of where the clip was left. Used when more
    // audio has just been unlocked and the point is to hear it from the start.
    restart() {
      return startRef.current(0, { optimistic: true })
    },
  }))

  // The first tap anywhere starts the audio context; Safari accepts nothing else.
  useEffect(() => { armAudioContext() }, [])

  useEffect(() => {
    if (!src) {
      setStatus('error')
      return
    }
    let cancelled = false
    let opened = null
    setStatus('loading')
    setDuration(0)
    durationRef.current = 0
    setPlayingState(false)
    setHeard(false)
    finishingRef.current = false
    cancelRetreat()
    paint(0)

    openClip(src).then((voice) => {
      if (cancelled) {
        voice.dispose()
        return
      }
      opened = voice
      voiceRef.current = voice
      voice.onEnd = () => finishRef.current()
      voice.onInterrupt = () => interruptRef.current()
      const known = () => {
        const d = voice.duration
        if (isFinite(d) && d > 0) {
          durationRef.current = d
          setDuration(d)
        }
      }
      known()
      voice.ready.then(() => {
        if (cancelled) return
        known()
        setStatus('ready')
      }, () => {
        if (cancelled) return
        setPlayingState(false)
        setPendingState(false)
        setStatus('error')
      })
      if (pendingRef.current || autoplayRef.current) {
        startRef.current(0, { optimistic: pendingRef.current })
      }
    })

    return () => {
      cancelled = true
      // An element carries on sounding after React takes it out of the page,
      // and so does a voice: a round that ends by swapping one player for
      // another would otherwise have both going at once.
      opened?.dispose()
      if (voiceRef.current === opened) voiceRef.current = null
      cancelRetreat()
    }
  }, [src, attempt])

  // More of the clip unlocked while it plays: let it run on to the new stop
  // rather than cutting it at the old one.
  useEffect(() => {
    maxRef.current = maxDuration
    const voice = voiceRef.current
    if (voice?.playing && playingRef.current) voice.extend(limit())
  }, [maxDuration])

  // Leaving the app mid-clip pauses it here, rather than leaving the page to
  // find out on the way back that the sound stopped.
  useEffect(() => {
    function onVisibility() {
      if (document.hidden && (playingRef.current || pendingRef.current)) pauseRef.current()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // The frame loop that moves the playhead and catches the end of a clip. The
  // stop itself is scheduled on the audio clock; this is only the picture of it.
  useEffect(() => {
    if (!playing) return
    let frame = requestAnimationFrame(function tick() {
      const voice = voiceRef.current
      if (voice && !scrubRef.current) {
        const t = voice.position()
        paint(t)
        if (voice.playing && t >= limit() - 0.0005) {
          finish()
          return
        }
      }
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [playing])

  // The rail's width, for placing the thumb in pixels.
  useLayoutEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const measure = () => {
      railWidthRef.current = rail.getBoundingClientRect().width
      if (!retreatRef.current && !scrubRef.current) paint(posRef.current)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(rail)
    return () => observer.disconnect()
  }, [Boolean(segments)])

  // Every render can change the segments under the playhead (a stage unlocking,
  // the duration arriving), so it is repainted from where it was.
  useLayoutEffect(() => {
    if (!retreatRef.current && !scrubRef.current) paint(posRef.current)
  })

  function togglePlay() {
    // A real tap is the only thing Safari will start the audio context on, and
    // this is the most reliable one the player gets.
    primeAudioContext()
    if (playingRef.current || pendingRef.current) pausePlayback()
    else startPlayback(undefined, { optimistic: true })
  }

  // ================================
  // SCRUBBING
  // ================================
  // A press on the bar jumps there; a drag moves the playhead with the finger
  // and keeps the sound quiet until it lifts, then picks up exactly where it
  // landed. Seeking on every pixel of a drag is what used to stutter: each seek
  // restarted the decoder, and they queued up behind the finger.

  function timeAtPointer(clientX) {
    const rail = railRef.current
    if (!rail) return 0
    const box = rail.getBoundingClientRect()
    const x = pixelToBar(segmentsRef.current, clientX - box.left, box.width, SEGMENT_GAP)
    // Only the stretch that can be heard: past it there is nothing to play, and
    // the playhead stops at the edge of it rather than following into the lock.
    const end = limit()
    return clamp(fromBar(x), 0, isFinite(end) ? end : barTotalRef.current || 0)
  }

  function onPointerDown(e) {
    if (!canSeek || e.button > 0 || scrubRef.current) return
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* not capturable */ }
    cancelRetreat()
    const voice = voiceRef.current
    const at = timeAtPointer(e.clientX)
    scrubRef.current = {
      id: e.pointerId,
      startX: e.clientX,
      wasPlaying: playingRef.current,
      from: voice ? voice.position() : posRef.current,
      held: false,
      at,
    }
    setScrubbing(true)
    paint(at)
  }

  function onPointerMove(e) {
    const s = scrubRef.current
    if (!s || e.pointerId !== s.id) return
    s.at = timeAtPointer(e.clientX)
    if (!s.held && Math.abs(e.clientX - s.startX) > DRAG_SLOP) {
      s.held = true
      // Quiet for the drag: what you hear should never contradict the playhead.
      if (s.wasPlaying) voiceRef.current?.pause()
    }
    paint(s.at)
  }

  function endScrub(e, commit) {
    const s = scrubRef.current
    if (!s || e.pointerId !== s.id) return
    scrubRef.current = null
    setScrubbing(false)
    const voice = voiceRef.current
    if (!voice) return
    // Cancelled means the browser took the touch for a scroll: nobody meant to
    // move the clip, so it goes back to where it was.
    const at = commit ? s.at : s.from
    if (s.wasPlaying) {
      if (!commit && !s.held) {
        paint(voice.position())
        return
      }
      startPlayback(at)
    } else {
      voice.park(at)
      paint(at)
    }
  }

  function onKeyDown(e) {
    if (!canSeek) return
    const voice = voiceRef.current
    if (!voice || !isFinite(limit())) return
    const end = Math.max(0, limit())
    const step = Math.max(0.1, Math.min(5, end / 20))
    const now = voice.position()
    let next = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = now + step
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = now - step
    else if (e.key === 'PageUp') next = now + step * 5
    else if (e.key === 'PageDown') next = now - step * 5
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = end
    if (next == null) return
    e.preventDefault()
    next = clamp(next, 0, end)
    if (playingRef.current) {
      startPlayback(next)
    } else {
      voice.park(next)
      paint(next)
    }
  }

  // ================================
  // DRAWING
  // ================================

  const busy = pending || (playing && status === 'loading')
  const unlockedBar = hasBar ? toBar(playable) : 1

  const playButton = (
    <button
      type="button"
      onClick={togglePlay}
      className={[
        'audio-play-btn btn-press',
        stage ? 'audio-stage__play' : 'audio-player__play-btn',
        playing ? 'playing' : '',
        busy ? 'audio-play-btn--busy' : '',
        !heard && !playing && !busy && status !== 'error' ? 'audio-play-btn--invite' : '',
      ].filter(Boolean).join(' ')}
      aria-label={playing || pending ? 'Pause' : 'Play'}
      aria-busy={busy || undefined}
    >
      {busy && <span className="audio-play-btn__spinner" aria-hidden="true" />}
      {playing || pending ? (
        <svg width={stage ? 18 : 12} height={stage ? 20 : 14} viewBox="0 0 12 14" fill="currentColor" aria-hidden="true">
          <rect x="0" y="0" width="4" height="14" rx="1" />
          <rect x="8" y="0" width="4" height="14" rx="1" />
        </svg>
      ) : (
        <svg width={stage ? 19 : 13} height={stage ? 20 : 14} viewBox="0 0 13 14" fill="currentColor" aria-hidden="true" className="audio-play-btn__play">
          <path d="M1 1L12 7L1 13V1Z" />
        </svg>
      )}
    </button>
  )

  const timeline = (
    <div className="audio-timeline">
      <div
        ref={trackRef}
        className={`audio-timeline__track${scrubbing ? ' audio-timeline__track--scrubbing' : ''}`}
        role="slider"
        tabIndex={canSeek ? 0 : -1}
        aria-label="Audio position"
        aria-valuemin={0}
        aria-valuemax={canSeek ? Math.round(playable * 10) / 10 : 0}
        aria-disabled={!canSeek || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endScrub(e, true)}
        onPointerCancel={(e) => endScrub(e, false)}
        onKeyDown={onKeyDown}
      >
        <div
          ref={railRef}
          className={`audio-timeline__rail${segments ? ' audio-timeline__rail--segmented' : ''}`}
          style={segments ? { gap: `${SEGMENT_GAP}px` } : undefined}
        >
          {segments ? segments.map((seg, i) => (
            <span
              key={i}
              className={[
                'audio-timeline__segment',
                seg.end <= playable + EPS ? 'audio-timeline__segment--unlocked' : '',
                i === unlockedCount - 1 ? 'audio-timeline__segment--current' : '',
                i === freshSegment ? 'audio-timeline__segment--fresh' : '',
              ].filter(Boolean).join(' ')}
              style={{ flexGrow: seg.width }}
            >
              <span ref={(el) => { fillRefs.current[i] = el }} className="audio-timeline__fill" />
            </span>
          )) : (
            <>
              {trackSpan ? (
                <span className="audio-timeline__unlocked" style={{ width: `${unlockedBar * 100}%` }} />
              ) : null}
              <span ref={fillRef} className="audio-timeline__fill" />
            </>
          )}
        </div>
        <span ref={thumbRef} className="audio-timeline__thumb" aria-hidden="true">
          <span className="audio-timeline__thumb-dot" />
        </span>
        {segments && freshSegment != null && segments[freshSegment] && (
          <span
            key={freshSegment}
            className="audio-timeline__gain"
            style={{ left: `${barToPixel(segments, segments[freshSegment].offset + segments[freshSegment].width / 2, railWidthRef.current, SEGMENT_GAP)}px` }}
            aria-hidden="true"
          >
            +{Math.round((segments[freshSegment].end - segments[freshSegment].start) * 10) / 10}s
          </span>
        )}
      </div>

      {segments ? (
        <div className="audio-timeline__labels" style={{ gap: `${SEGMENT_GAP}px` }}>
          {segments.map((seg, i) => {
            const given = segmentLabels?.[i]
            const tone = given?.tone || (seg.end <= playable + EPS ? 'unlocked' : 'locked')
            return (
              <span
                key={i}
                className={`audio-timeline__label audio-timeline__label--${tone}`}
                style={{ flexGrow: seg.width }}
              >
                {given?.content ?? `${seg.end}s`}
              </span>
            )
          })}
        </div>
      ) : (
        <div className="audio-timeline__times">
          <span ref={timeRef} className="audio-timeline__time" />
          <span className="audio-timeline__time audio-timeline__time--total">
            {/* Rounded rather than floored: a decoded preview runs a hair
                under thirty seconds, and 0:29 reads as a different clip. */}
            {hasBar ? fmt(Math.round(barTotal)) : '--:--'}
          </span>
        </div>
      )}

      {status === 'error' && (
        <p className="audio-player__error" role="status">
          This clip didn't load. Check your connection and try again.
          <button type="button" className="audio-player__retry btn-press" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </p>
      )}
    </div>
  )

  if (stage) {
    return (
      <div ref={stageRef} className={`audio-stage audio-stage--${visual}${playing ? ' audio-stage--playing' : ''}`}>
        <div className="audio-stage__card">
          {children && <div className="audio-stage__head">{children}</div>}
          <div className="audio-stage__visual">
            <AudioVisual kind={visual} playing={playing} voiceRef={voiceRef} stageRef={stageRef} className="audio-stage__canvas" />
            {playButton}
          </div>
          {timeline}
        </div>
      </div>
    )
  }

  return (
    <div ref={stageRef} className={`audio-player${playing ? ' audio-player--playing' : ''}`}>
      {/* Behind everything, spanning the card: it only says "sound is coming out
          right now", so it stays mounted and fades rather than popping in and
          out. A still canvas costs nothing, so an idle player is free. */}
      <AudioVisual kind="backdrop" playing={playing} voiceRef={voiceRef} className="audio-player__backdrop" />
      {label && <p className="audio-player__label">{label}</p>}
      <div className="audio-player__controls">
        {playButton}
        <div className="audio-player__progress">{timeline}</div>
      </div>
    </div>
  )
})

export default AudioPlayer
