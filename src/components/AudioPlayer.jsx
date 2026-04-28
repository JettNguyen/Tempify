import { useState, useRef, useEffect } from 'react'

export default function AudioPlayer({ src, maxDuration, label }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // maxDuration caps playback (used in One Bar game)
  const limit = maxDuration || Infinity

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

  // Reset when src changes
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
    }
  }

  const effectiveDuration = maxDuration || duration
  const progress = effectiveDuration > 0 ? Math.min(currentTime / effectiveDuration, 1) : 0

  function fmt(s) {
    if (!isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      padding: '1rem 1.25rem',
    }}>
      {label && (
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          {label}
        </p>
      )}

      <audio ref={audioRef} src={src} preload="metadata" />

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={togglePlay}
          className="btn-press"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'var(--amber)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
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

        <div style={{ flex: 1 }}>
          <div
            style={{
              height: '3px',
              background: 'var(--border)',
              borderRadius: '2px',
              overflow: 'hidden',
              marginBottom: '6px',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress * 100}%`,
                background: 'var(--amber)',
                borderRadius: '2px',
                transition: 'width 100ms linear',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {fmt(currentTime)}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
              {effectiveDuration > 0 && isFinite(effectiveDuration)
                ? fmt(effectiveDuration)
                : '--:--'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
