import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { searchSongs, getCachedSongSearch } from '../lib/itunes'
import './GuessInput.css'

const GuessInput = forwardRef(function GuessInput({ onGuess, disabled, placeholder = 'Search for a song...' }, ref) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)
  const containerRef = useRef(null)
  const requestIdRef = useRef(0)

  useImperativeHandle(ref, () => ({
    clear() {
      setQuery('')
      setResults([])
      setOpen(false)
    },
  }))

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
    const requestId = ++requestIdRef.current

    clearTimeout(debounceRef.current)
    if (val.trim().length < 2) {
      setResults([])
      setOpen(false)
      setLoading(false)
      return
    }

    const cachedHits = getCachedSongSearch(val)
    if (cachedHits.length > 0) {
      setResults(cachedHits)
      setOpen(true)
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const hits = await searchSongs(val)
      if (requestId !== requestIdRef.current) return
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
    <div ref={containerRef} className="guess-input">
      <div className="guess-input__field-wrap">
        <input
          type="text"
          value={query}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          className="guess-input__field"
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {loading && <span className="guess-input__searching">searching</span>}
      </div>

      {open && (
        <div className="guess-input__dropdown">
          {results.map((song) => (
            <button
              key={song.id}
              onClick={() => selectResult(song)}
              className="guess-input__option btn-hover"
            >
              <div className="guess-input__option-title">{song.title}</div>
              <div className="guess-input__option-artist">{song.artist}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

export default GuessInput
