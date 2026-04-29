import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { searchUsers } from '../lib/scores'
import Avatar from './Avatar'
import logoUrl from '/favicon.svg'
import './Navbar.css'

export default function Navbar() {
  const { user, profile } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const debounce = useRef(null)
  const searchWrap = useRef(null)

  const initial = (profile?.email || user?.email || '').split('@')[0][0]?.toUpperCase() ?? '?'
  const isSubscribed = profile?.is_subscribed
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL?.trim()
  const currentEmail = (profile?.email || user?.email || '').trim()
  const isAdmin = !!adminEmail && currentEmail === adminEmail

  // Close search on outside click
  useEffect(() => {
    function close(e) { if (searchWrap.current && !searchWrap.current.contains(e.target)) setSearchOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  function handleSearchChange(e) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounce.current)
    if (val.trim().length < 2) { setResults([]); return }
    debounce.current = setTimeout(async () => {
      const hits = await searchUsers(val)
      setResults(hits)
    }, 280)
  }

  function pickResult(username) {
    setSearchOpen(false)
    setQuery('')
    setResults([])
    navigate(`/u/${username}`)
  }

  function linkClass(path) {
    const active = pathname === path || (path !== '/' && pathname.startsWith(path))
    return `navbar__link nav-link${active ? ' navbar__link--active' : ''}`
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar__brand">
        <img src={logoUrl} alt="" aria-hidden="true" className="navbar__logo" />
        <span className="navbar__wordmark">Tempify</span>
      </Link>

      <div className="navbar__links">
        {user ? (
          <>
            {/* Search */}
            <div ref={searchWrap} className="navbar__search-wrap">
              {searchOpen ? (
                <div className="navbar__search-box">
                  <input
                    autoFocus
                    value={query}
                    onChange={handleSearchChange}
                    placeholder="Search users…"
                    className="navbar__search-input"
                    onKeyDown={e => e.key === 'Escape' && setSearchOpen(false)}
                  />
                  {results.length > 0 && (
                    <div className="navbar__search-results">
                      {results.map(u => (
                        <button
                          key={u.id}
                          className="navbar__search-result"
                          onClick={() => pickResult(u.username)}
                        >
                          <Avatar iconKey={u.avatar_icon} color={u.avatar_color} initial={u.username?.[0]?.toUpperCase() ?? '?'} size={22} />
                          <span>{u.username || u.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button className="navbar__search-btn" onClick={() => setSearchOpen(true)} title="Search users">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </button>
              )}
            </div>

            <Link to="/dashboard" className={linkClass('/dashboard')}>Dashboard</Link>
            {isSubscribed && (
              <Link to="/explore" className={linkClass('/explore')}>Explore</Link>
            )}
            {isAdmin && (
              <Link to="/admin" className={`${linkClass('/admin')} navbar__link--admin`}>Admin</Link>
            )}
            <Link to="/profile" className="btn-press" title="Your profile">
              <Avatar iconKey={profile?.avatar_icon} color={profile?.avatar_color} initial={initial} size={32} />
            </Link>
          </>
        ) : (
          <>
            <Link to="/login" className={linkClass('/login')}>Log in</Link>
            <Link to="/signup" className="navbar__signup btn-press btn-amber">Sign up</Link>
          </>
        )}
      </div>
    </nav>
  )
}
