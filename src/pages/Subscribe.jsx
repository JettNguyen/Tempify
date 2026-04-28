import { useAuth } from '../hooks/useAuth'

export default function Subscribe() {
  const { user } = useAuth()

  function handleSubscribe() {
    const link = import.meta.env.VITE_STRIPE_PAYMENT_LINK
    if (!link) {
      console.warn('VITE_STRIPE_PAYMENT_LINK is not set.')
      return
    }
    const url = new URL(link)
    if (user?.email) url.searchParams.set('prefilled_email', user.email)
    window.location.href = url.toString()
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.25rem',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          tempify+
        </p>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 500,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          marginBottom: '0.75rem',
        }}>
          Every day, going back forever.
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: 1.7 }}>
          Unlock the full archive, browse by genre, and get recommendations based on
          what you actually play. Streaks carry across all five games.
        </p>

        <div style={{
          padding: '1.5rem',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          marginBottom: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '28px', fontWeight: 500, color: 'var(--text-primary)' }}>$3</span>
            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/ month</span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
            Cancel any time, no questions.
          </p>
        </div>

        <button
          onClick={handleSubscribe}
          className="btn-press"
          style={{
            width: '100%',
            padding: '12px',
            background: 'var(--amber)',
            border: 'none',
            borderRadius: '8px',
            color: '#0f0f0f',
            fontSize: '15px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Subscribe — $3/mo
        </button>

        {!user && (
          <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '1rem', textAlign: 'center' }}>
            You'll be asked to log in or create an account.
          </p>
        )}
      </div>
    </div>
  )
}
