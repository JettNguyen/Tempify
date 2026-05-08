import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { openExternalUrlInApp } from '../lib/inAppBrowser'
import { usesNativeIap, presentPaywall, restorePurchases } from '../lib/billing'
import './Subscribe.css'

export default function Subscribe() {
  const { user, refreshProfile, markSubscribed } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const nativeIap = usesNativeIap()

  async function handleSubscribe() {
    if (busy) return

    if (nativeIap) {
      setBusy(true)
      setMessage('')
      try {
        // Always shows the RC native paywall so users can see plans and manage their subscription.
        const { purchased } = await presentPaywall()
        if (purchased) {
          await markSubscribed()
          navigate('/archive')
        }
        // If dismissed/cancelled, no message — just close.
      } catch (err) {
        setMessage(err?.message || 'Unable to complete purchase right now.')
      } finally {
        setBusy(false)
      }
      return
    }

    // Web: redirect to Stripe payment link
    const link = import.meta.env.VITE_STRIPE_PAYMENT_LINK
    if (!link) {
      console.warn('VITE_STRIPE_PAYMENT_LINK is not set.')
      return
    }
    const url = new URL(link)
    if (user?.email) url.searchParams.set('prefilled_email', user.email)
    await openExternalUrlInApp(url.toString())
  }

  async function handleRestore() {
    if (busy || !nativeIap) return
    setBusy(true)
    setMessage('')
    try {
      const restored = await restorePurchases()
      await refreshProfile()
      setMessage(restored ? 'Purchases restored!' : 'No active subscription found to restore.')
    } catch (err) {
      setMessage(err?.message || 'Unable to restore purchases right now.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="subscribe-page">
      <div className="subscribe-card">
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'block',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '13px',
            cursor: 'pointer',
            padding: 0,
            marginBottom: '1.5rem',
          }}
        >
          ← Back
        </button>
        <p className="subscribe-eyebrow">tempify+</p>
        <h1 className="subscribe-title">Every day, going back forever.</h1>
        <p className="subscribe-body">
          Unlock the full archive, browse by genre, and get recommendations based on
          what you actually play. Streaks carry across all five games.
        </p>

        <div className="subscribe-price-box">
          <div className="subscribe-price-row">
            <span className="subscribe-price">$3</span>
            <span className="subscribe-price-unit">/ month</span>
          </div>
          <p className="subscribe-fine-print">Cancel any time, no questions.</p>
        </div>

        <button onClick={handleSubscribe} className="subscribe-cta btn-press" disabled={busy}>
          {busy ? 'Please wait…' : nativeIap ? 'See Plans' : 'Subscribe — $3/mo'}
        </button>

        {nativeIap && (
          <button onClick={handleRestore} className="subscribe-restore btn-press btn-hover" disabled={busy}>
            Restore purchases
          </button>
        )}

        {message && <p className="subscribe-hint">{message}</p>}

        {!user && (
          <p className="subscribe-hint">You'll be asked to log in or create an account.</p>
        )}

        <p className="subscribe-legal">
          {nativeIap ? (
            <button
              className="subscribe-legal-btn"
              onClick={() => openExternalUrlInApp('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}
            >
              Terms of Use
            </button>
          ) : (
            <Link to="/terms">Terms of Use</Link>
          )}
          {' · '}
          <Link to="/privacy">Privacy Policy</Link>
        </p>
      </div>
    </div>
  )
}
