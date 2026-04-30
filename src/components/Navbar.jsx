import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Avatar from './Avatar'
import SearchModal from './SearchModal'
import logoUrl from '/favicon.svg'
import './Navbar.css'

export default function Navbar() {
  const { user, profile } = useAuth()
  const { pathname } = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)

  const initial = (profile?.email || user?.email || '').split('@')[0][0]?.toUpperCase() ?? '?'
  const isSubscribed = profile?.is_subscribed
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL?.trim()
  const currentEmail = (profile?.email || user?.email || '').trim()
  const isAdmin = !!adminEmail && currentEmail === adminEmail

  function linkClass(path) {
    const active = pathname === path || (path !== '/' && pathname.startsWith(path))
    return `navbar__link nav-link${active ? ' navbar__link--active' : ''}`
  }

  return (
    <>
      <nav className="navbar">
        <Link to="/" className="navbar__brand">
          <img src={logoUrl} alt="" aria-hidden="true" className="navbar__logo" />
          <span className="navbar__wordmark">Tempify</span>
        </Link>

        <div className="navbar__links">
          {user ? (
            <>
              <button className="navbar__search-btn" onClick={() => setSearchOpen(true)} title="Search users">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </button>
              <Link to="/explore" className={linkClass('/explore')}>Explore</Link>
              {isAdmin && (
                <Link to="/admin" className={`${linkClass('/admin')} navbar__link--admin`}>Admin</Link>
              )}
              <Link to={profile?.username ? `/u/${profile.username}` : '/profile'} className="btn-press" title="Your profile">
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

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </>
  )
}
