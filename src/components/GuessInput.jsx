import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { searchSongsWithStatus, getCachedSongSearch } from '../lib/deezer'
import { hapticSelection } from '../lib/haptics'
import { dismissKeyboard } from '../lib/keyboard'
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
  const [dropUp, setDropUp] = useState(false)
  const [listMax, setListMax] = useState(260)
  const debounceRef = useRef(null)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const requestIdRef = useRef(0)
  const abortRef = useRef(null)

  const showList = open && !disabled

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
        if (containerRef.current.contains(document.activeElement)) dismissKeyboard()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [])

  // The on-screen keyboard covers the bottom of the window, so a list sized to
  // the window runs underneath it and can't be scrolled to. visualViewport
  // reports the area actually visible, so size the list to that — and flip the
  // list above the field when there's more room up there.
  useEffect(() => {
    if (!showList) return

    function measure() {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const vv = window.visualViewport
      const viewTop = vv ? vv.offsetTop : 0
      const viewBottom = vv ? vv.offsetTop + vv.height : window.innerHeight

      const below = viewBottom - rect.bottom - 16
      const above = rect.top - viewTop - 16
      const flip = below < 168 && above > below

      setDropUp(flip)
      setListMax(Math.max(112, Math.min(280, Math.floor(flip ? above : below))))
    }

    measure()
    const vv = window.visualViewport
    vv?.addEventListener('resize', measure)
    vv?.addEventListener('scroll', measure)
    window.addEventListener('resize', measure)
    return () => {
      vv?.removeEventListener('resize', measure)
      vv?.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [showList, results.length, status])

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
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const { tracks, failed } = await searchSongsWithStatus(val, { signal: controller.signal })
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
    }, 150)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
      dismissKeyboard()
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
      e.preventDefault()
      // Only a row you actually highlighted gets submitted. On a phone the
      // return key reads as "done typing", and guessing the top hit for you
      // spends one of six attempts on a song you never picked.
      if (activeIndex >= 0 && results[activeIndex]) {
        selectResult(results[activeIndex])
        return
      }
      // Nothing chosen: put the keyboard away and leave the list up to tap.
      dismissKeyboard()
    }
  }

  function selectResult(song) {
    hapticSelection()
    // The guess is committed — nothing left to type, so get the keyboard out of
    // the way of the game.
    dismissKeyboard()
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
            className="guess-input__clear btn-press"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
          >
            ✕
          </button>
        )}
      </div>

      {showList && (
        <div className={`guess-input__dropdown${dropUp ? ' guess-input__dropdown--up' : ''}`}>
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
            <div
              ref={listRef}
              id={LISTBOX_ID}
              role="listbox"
              className="guess-input__options"
              style={{ maxHeight: `${listMax}px` }}
            >
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
