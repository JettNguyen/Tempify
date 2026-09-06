import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { searchSongsWithStatus, getCachedSongSearch } from '../lib/deezer'
import './GuessInput.css'

const LISTBOX_ID = 'guess-input-listbox'
const optionId = (i) => `guess-input-option-${i}`

const GuessInput = forwardRef(function GuessInput({ onGuess, disabled, placeholder = 'Search for a song...' }, ref) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  // idle | loading | ready | empty | error
  const [status, setStatus] = useState('idle')
  const [activeIndex, setActiveIndex] = useState(-1)
  const debounceRef = useRef(null)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const requestIdRef = useRef(0)

  function reset() {
    clearTimeout(debounceRef.current)
    requestIdRef.current++
    setQuery('')
    setResults([])
    setOpen(false)
    setStatus('idle')
    setActiveIndex(-1)
  }

  useImperativeHandle(ref, () => ({ clear: reset }))

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
      clearTimeout(debounceRef.current)
    }
  }, [])

  // Keep the keyboard-highlighted row visible when the list scrolls.
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return
    listRef.current.children[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    setActiveIndex(-1)
    const requestId = ++requestIdRef.current

    clearTimeout(debounceRef.current)
    if (val.trim().length < 2) {
      setResults([])
      setOpen(false)
      setStatus('idle')
      return
    }

    // Show any prefix-cached hits straight away so the list never goes blank
    // between keystrokes, but stay in `loading` so Enter can't submit them.
    setResults(getCachedSongSearch(val))
    setStatus('loading')
    setOpen(true)

    debounceRef.current = setTimeout(async () => {
      const { tracks, failed } = await searchSongsWithStatus(val)
      if (requestId !== requestIdRef.current) return
      setOpen(true)
      // On failure keep whatever rows are already on screen — they are still
      // real songs the player can pick — and just say the refresh didn't land.
      if (failed) {
        setStatus('error')
        return
      }
      setResults(tracks)
      setActiveIndex(-1)
      setStatus(tracks.length > 0 ? 'ready' : 'empty')
    }, 180)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
      return
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (results.length === 0) return
      e.preventDefault()
      if (!open) setOpen(true)
      setActiveIndex((i) => {
        if (e.key === 'ArrowDown') return i + 1 >= results.length ? 0 : i + 1
        return i <= 0 ? results.length - 1 : i - 1
      })
      return
    }

    if (e.key === 'Enter') {
      // Only submit a highlighted row, or the top hit once the results on
      // screen are known to match what was typed — never a stale cached row.
      const target = activeIndex >= 0
        ? results[activeIndex]
        : status === 'ready' ? results[0] : null
      if (!target) return
      e.preventDefault()
      selectResult(target)
    }
  }

  function selectResult(song) {
    clearTimeout(debounceRef.current)
    requestIdRef.current++
    setQuery(`${song.title} — ${song.artist}`)
    setOpen(false)
    setResults([])
    setStatus('idle')
    setActiveIndex(-1)
    onGuess(song)
  }

  function handleClear() {
    reset()
    inputRef.current?.focus()
  }

  const showList = open && !disabled

  return (
    <div ref={containerRef} className="guess-input">
      <div className="guess-input__field-wrap">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className="guess-input__field"
          onFocus={() => results.length > 0 && setOpen(true)}
          role="combobox"
          aria-expanded={showList}
          aria-controls={LISTBOX_ID}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
        />
        {query.length > 0 && !disabled && (
          <button
            type="button"
            className="guess-input__clear"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
          >
            ✕
          </button>
        )}
      </div>

      {showList && (
        <div className="guess-input__dropdown">
          {results.length === 0 && (
            <p className="guess-input__message">
              {status === 'error'
                ? "Couldn't reach search — check your connection."
                : status === 'empty'
                  ? `No songs found for “${query.trim()}”.`
                  : 'Searching…'}
            </p>
          )}

          {results.length > 0 && (
            <div ref={listRef} id={LISTBOX_ID} role="listbox" className="guess-input__options">
              {results.map((song, i) => (
                <button
                  key={song.id}
                  type="button"
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === activeIndex}
                  onClick={() => selectResult(song)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`guess-input__option btn-hover${i === activeIndex ? ' guess-input__option--active' : ''}`}
                >
                  <div className="guess-input__option-title">{song.title}</div>
                  <div className="guess-input__option-artist">{song.artist}</div>
                </button>
              ))}
            </div>
          )}

          {results.length > 0 && (status === 'loading' || status === 'error') && (
            <p className="guess-input__message guess-input__message--footer">
              {status === 'error' ? "Couldn't refresh — showing earlier matches." : 'Searching…'}
            </p>
          )}
        </div>
      )}
    </div>
  )
})

export default GuessInput
