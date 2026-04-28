import { Link } from 'react-router-dom'

export default function ArchiveLock() {
  return (
    <div className="slide-up" style={{
      textAlign: 'center',
      padding: '3rem 1.5rem',
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1.25rem',
      }}>
        <svg width="16" height="18" viewBox="0 0 16 18" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round">
          <rect x="2" y="8" width="12" height="10" rx="2"/>
          <path d="M5 8V5a3 3 0 0 1 6 0v3"/>
        </svg>
      </div>
      <p style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
        Archive is for subscribers
      </p>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '280px', margin: '0 auto 1.5rem' }}>
        Play back any day with a Tempify subscription.
      </p>
      <Link
        to="/subscribe"
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
        See plans
      </Link>
    </div>
  )
}
