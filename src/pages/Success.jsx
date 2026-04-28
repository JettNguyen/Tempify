import { Link } from 'react-router-dom'

export default function Success() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.25rem',
    }}>
      <div style={{ maxWidth: '400px', textAlign: 'center' }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: 'var(--amber-glow)',
          border: '1px solid var(--amber)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem',
        }}>
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
            <path d="M1 7L6.5 12.5L17 1" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          You're in.
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '1.75rem' }}>
          The full archive is now unlocked. Go back and play anything you've missed.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <Link
            to="/archive"
            className="btn-press"
            style={{
              display: 'inline-block',
              background: 'var(--amber)',
              color: '#0f0f0f',
              fontSize: '13px',
              fontWeight: 500,
              padding: '9px 20px',
              borderRadius: '999px',
            }}
          >
            Open archive
          </Link>
          <Link
            to="/"
            style={{
              display: 'inline-block',
              fontSize: '13px',
              color: 'var(--text-muted)',
              padding: '9px 20px',
              border: '1px solid var(--border)',
              borderRadius: '999px',
            }}
          >
            Today's games
          </Link>
        </div>
      </div>
    </div>
  )
}
