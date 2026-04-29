import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import './AudioPlayer.css'

const AudioPlayer = forwardRef(function AudioPlayer({ src, maxDuration, label, onPlay }, ref) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const limit = maxDuration || Infinity

  useImperativeHandle(ref, () => ({
    pause() {
      if (audioRef.current) {
        audioRef.current.pause()
        setPlaying(false)
      }
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
        setPlaying(false)
        setCurrentTime(0)
      }
    }
    const onEnded = () => {
      setPlaying(false)
      setCurrentTime(0)
    }

    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('ended', onEnded)
    }
  }, [maxDuration])

  useEffect(() => {
    setPlaying(false)
    setCurrentTime(0)
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.pause()
    }
  }, [src])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play()
      setPlaying(true)
      onPlay?.()
    }
  }

  const effectiveDuration = maxDuration || duration
  const progress = effectiveDuration > 0 ? Math.min(currentTime / effectiveDuration, 1) : 0

  function handleSeek(event) {
    const audio = audioRef.current
    if (!audio || !isFinite(effectiveDuration) || effectiveDuration <= 0) return
    const nextTime = Math.min(Number(event.target.value), effectiveDuration)
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

      <audio ref={audioRef} src={src} preload="metadata" />

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
            <span
              className="audio-player__fill"
              style={{ width: `${progress * 100}%` }}
            />
            <input
              className="audio-player__scrubber"
              type="range"
              min="0"
              max={effectiveDuration > 0 && isFinite(effectiveDuration) ? effectiveDuration : 0}
              step="0.01"
              value={Math.min(currentTime, effectiveDuration || 0)}
              onChange={handleSeek}
              disabled={!src || !isFinite(effectiveDuration) || effectiveDuration <= 0}
            />
          </label>
          <div className="audio-player__times">
            <span className="audio-player__time">{fmt(currentTime)}</span>
            <span className="audio-player__time audio-player__time--total">
              {effectiveDuration > 0 && isFinite(effectiveDuration)
                ? fmt(effectiveDuration)
                : '--:--'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
})

export default AudioPlayer
