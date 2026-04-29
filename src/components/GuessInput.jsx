import { useState, useRef, useEffect } from 'react'
import { searchSongs } from '../lib/itunes'

export default function GuessInput({ onGuess, disabled, placeholder = 'Search for a song...' }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)

    clearTimeout(debounceRef.current)
    if (val.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const hits = await searchSongs(val)
      setResults(hits)
      setOpen(hits.length > 0)
      setLoading(false)
    }, 180)
  }

  function selectResult(song) {
    setQuery(`${song.title} — ${song.artist}`)
    setOpen(false)
    setResults([])
    onGuess(song)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          style={{
            width: '100%',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '10px 14px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            outline: 'none',
            opacity: disabled ? 0.5 : 1,
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {loading && (
          <span style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '11px',
            color: 'var(--text-dim)',
          }}>
            searching
          </span>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          overflow: 'hidden',
          zIndex: 50,
        }}>
          {results.map((song) => (
            <button
              key={song.id}
              onClick={() => selectResult(song)}
              className="btn-hover"
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>
                {song.title}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>
                {song.artist}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
