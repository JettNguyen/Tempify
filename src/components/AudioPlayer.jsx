import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import './AudioPlayer.css'

// Bar count is mirrored by the nth-child heights in AudioPlayer.css.
const WAVE_BARS = 9

const AudioPlayer = forwardRef(function AudioPlayer({ src, maxDuration, trackSpan, label, onPlay, autoplay }, ref) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
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

    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlayEvent)
    audio.addEventListener('pause', onPauseEvent)
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlayEvent)
      audio.removeEventListener('pause', onPauseEvent)
    }
  }, [maxDuration])

  useEffect(() => {
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

  const progress = hasBar ? Math.min(currentTime / barTotal, 1) : 0
  const unlockedPct = hasBar ? Math.min(playable / barTotal, 1) * 100 : 100

  function handleSeek(event) {
    const audio = audioRef.current
    if (!audio || !isFinite(playable) || playable <= 0) return
    const nextTime = Math.min(Number(event.target.value), playable)
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
      {label && <p className="audio-player__label">{label}</p>}

      <audio ref={audioRef} src={src} preload="auto" playsInline />

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
          <label className="audio-player__track" aria-label="Audio position">
            {trackSpan ? (
              <span
                className="audio-player__unlocked"
                style={{ width: `${unlockedPct}%` }}
              />
            ) : null}
            <span
              className="audio-player__fill"
              style={{ width: `${progress * 100}%` }}
            />
            {/* Narrowed to the unlocked stretch: dragging past it would seek
                into audio that can't play, and the thumb would sit nowhere
                near the finger. */}
            <input
              className="audio-player__scrubber"
              style={{ width: `${unlockedPct}%` }}
              type="range"
              min="0"
              max={playable > 0 && isFinite(playable) ? playable : 0}
              step="0.01"
              value={Math.min(currentTime, playable || 0)}
              onChange={handleSeek}
              disabled={!src || !isFinite(playable) || playable <= 0}
            />
          </label>
          <div className="audio-player__times">
            <span className="audio-player__time">{fmt(currentTime)}</span>

            {/* Decorative: it only says "sound is coming out right now", so it
                stays mounted and fades rather than popping in and out. Paused
                animations cost nothing, so an idle player is free. */}
            <span
              className={`audio-player__wave${playing ? ' audio-player__wave--active' : ''}`}
              aria-hidden="true"
            >
              {Array.from({ length: WAVE_BARS }).map((_, i) => (
                <span key={i} className="audio-player__wave-bar" />
              ))}
            </span>

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
