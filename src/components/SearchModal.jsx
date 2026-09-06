import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchUsers } from '../lib/scores'
import Avatar from './Avatar'
import './SearchModal.css'

export default function SearchModal({ onClose }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const debounce = useRef(null)
  const inputRef = useRef(null)
  const requestId = useRef(0)

  useLayoutEffect(() => {
    const focusInput = () => {
      const input = inputRef.current
      if (!input) return
      input.focus({ preventScroll: true })
      input.click()
    }

    // iOS Safari/WKWebView can ignore the first programmatic focus during modal mount.
    // Retry focus shortly after paint to reliably open the keyboard.
    focusInput()
    const rafId = requestAnimationFrame(focusInput)
    const t1 = window.setTimeout(focusInput, 60)
    const t2 = window.setTimeout(focusInput, 180)

    return () => {
      cancelAnimationFrame(rafId)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => () => clearTimeout(debounce.current), [])

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    const id = ++requestId.current
    clearTimeout(debounce.current)
    if (val.trim().length < 2) { setResults([]); setSearching(false); return }
    setSearching(true)
    debounce.current = setTimeout(async () => {
      let hits = []
      try {
        hits = await searchUsers(val)
      } catch {
        // Treat a failed lookup as no matches rather than hanging on "Searching…".
      }
      // Drop responses that a newer keystroke has already superseded.
      if (id !== requestId.current) return
      setResults(hits)
      setSearching(false)
    }, 280)
  }

  function pick(username) {
    onClose()
    navigate(`/u/${username}`)
  }

  return (
    <div className="search-modal__backdrop" onMouseDown={onClose}>
      <div className="search-modal__card" onMouseDown={e => e.stopPropagation()}>
        <div className="search-modal__input-row">
          <svg className="search-modal__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={handleChange}
            placeholder="Search users by username…"
            className="search-modal__input"
          />
          <button className="search-modal__close" onClick={onClose}>✕</button>
        </div>

        {query.trim().length >= 2 && (
          <div className="search-modal__results">
            {searching ? (
              <p className="search-modal__empty">Searching…</p>
            ) : results.length === 0 ? (
              <p className="search-modal__empty">No users found.</p>
            ) : (
              results.map(u => (
                <button key={u.id} className="search-modal__result btn-press" onClick={() => pick(u.username)}>
                  <Avatar iconKey={u.avatar_icon} color={u.avatar_color} initial={u.username?.[0]?.toUpperCase() ?? '?'} size={28} />
                  <span className="search-modal__result-name">@{u.username}</span>
                  {u.is_subscribed && (
                    <span className="search-modal__result-badge">Premium</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
