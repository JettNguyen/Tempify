import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const initials = profile?.email
    ? profile.email.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? '?'

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

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
            <Link
              to="/dashboard"
              style={{ color: 'var(--text-muted)', fontSize: '14px' }}
            >
              Dashboard
            </Link>
            <button
              onClick={handleSignOut}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Sign out"
              className="btn-press"
            >
              {initials}
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              style={{ color: 'var(--text-muted)', fontSize: '14px' }}
            >
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
