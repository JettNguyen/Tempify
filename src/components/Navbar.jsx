import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Avatar from './Avatar'

export default function Navbar() {
  const { user, profile } = useAuth()

  const initial = (profile?.email || user?.email || '').split('@')[0][0]?.toUpperCase() ?? '?'
  const isSubscribed = profile?.is_subscribed
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL?.trim()
  const currentEmail = (profile?.email || user?.email || '').trim()
  const isAdmin = !!adminEmail && currentEmail === adminEmail

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '52px',
      background: 'var(--bg)',
      borderBottom: '0.5px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.25rem',
      zIndex: 100,
    }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        <span style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 500,
          fontSize: '18px',
          letterSpacing: '-0.04em',
          color: 'var(--text-primary)',
        }}>
          Tempify
        </span>
        <span style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          background: 'var(--amber)',
          display: 'inline-block',
          marginLeft: '1px',
          marginBottom: '1px',
          flexShrink: 0,
        }} />
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {user ? (
          <>
            <Link to="/dashboard" style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              Dashboard
            </Link>
            {isSubscribed && (
              <Link to="/explore" style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Explore
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin" style={{ color: 'var(--amber)', fontSize: '14px' }}>
                Admin
              </Link>
            )}
            <Link to="/profile" className="btn-press" style={{ display: 'flex', alignItems: 'center' }} title="Your profile">
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
            <Link to="/login" style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              Log in
            </Link>
            <Link
              to="/signup"
              className="btn-press"
              style={{
                background: 'var(--amber)',
                color: '#0f0f0f',
                fontSize: '13px',
                fontWeight: 500,
                padding: '6px 14px',
                borderRadius: '999px',
                display: 'inline-block',
                lineHeight: 1,
              }}
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
