import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Subscribe() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  async function handleSubscribe() {
    setLoading(true)
    const priceId = import.meta.env.VITE_STRIPE_PRICE_ID
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

    // Use Stripe Checkout redirect model
    // In production, you'd call your backend to create a Checkout session.
    // This is a client-side redirect to Stripe's hosted checkout.
    const params = new URLSearchParams({
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      mode: 'subscription',
      success_url: window.location.origin + '/Tempify/success',
      cancel_url: window.location.origin + '/Tempify/subscribe',
    })

    // For the redirect model without a backend, we link to your Stripe payment link directly.
    // Replace with your actual Stripe payment link URL.
    window.location.href = `https://buy.stripe.com/placeholder?prefilled_email=${encodeURIComponent(user?.email || '')}`
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
          Unlock the full archive and replay any date from the beginning. Streaks are saved across
          all five games, and your history is always there when you come back.
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
          disabled={loading}
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
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Redirecting...' : 'Subscribe — $3/mo'}
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
