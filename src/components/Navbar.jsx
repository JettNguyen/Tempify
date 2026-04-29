import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Avatar from './Avatar'
import logoUrl from '/favicon.svg'
import './Navbar.css'

export default function Navbar() {
  const { user, profile } = useAuth()

  const initial = (profile?.email || user?.email || '').split('@')[0][0]?.toUpperCase() ?? '?'
  const isSubscribed = profile?.is_subscribed
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL?.trim()
  const currentEmail = (profile?.email || user?.email || '').trim()
  const isAdmin = !!adminEmail && currentEmail === adminEmail

  return (
    <nav className="navbar">
      <Link to="/" className="navbar__brand">
        <img src={logoUrl} alt="" aria-hidden="true" className="navbar__logo" />
        <span className="navbar__wordmark">Tempify</span>
      </Link>

      <div className="navbar__links">
        {user ? (
          <>
            <Link to="/dashboard" className="navbar__link nav-link">Dashboard</Link>
            {isSubscribed && (
              <Link to="/explore" className="navbar__link nav-link">Explore</Link>
            )}
            {isAdmin && (
              <Link to="/admin" className="navbar__link navbar__link--admin nav-link">Admin</Link>
            )}
            <Link to="/profile" className="btn-press" title="Your profile">
              <Avatar
                iconKey={profile?.avatar_icon}
                color={profile?.avatar_color}
                initial={initial}
                size={32}
              />
            </Link>
          </>
        ) : (
          <>
            <Link to="/login" className="navbar__link nav-link">Log in</Link>
            <Link to="/signup" className="navbar__signup btn-press btn-amber">Sign up</Link>
          </>
        )}
      </div>
    </nav>
  )
}
