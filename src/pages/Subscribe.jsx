import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { openExternalUrlInApp } from '../lib/inAppBrowser'
import { usesNativeIap, presentPaywall, restorePurchases } from '../lib/billing'
import './Subscribe.css'

const WEB_PLANS = [
  {
    key: 'monthly',
    label: 'Monthly',
    price: '$3',
    unit: '/ month',
    cta: 'Subscribe monthly',
    linkEnv: 'VITE_STRIPE_PAYMENT_LINK_MONTHLY',
    fallbackEnv: 'VITE_STRIPE_PAYMENT_LINK',
    note: 'Cancel any time.',
  },
  {
    key: 'yearly',
    label: 'Yearly',
    price: '$25',
    unit: '/ year',
    cta: 'Subscribe yearly',
    linkEnv: 'VITE_STRIPE_PAYMENT_LINK_YEARLY',
    badge: 'Save 31%',
    note: 'Buy yearly and save $11.',
  },
  {
    key: 'lifetime',
    label: 'Lifetime',
    price: '$100',
    unit: ' once',
    cta: 'Buy lifetime',
    linkEnv: 'VITE_STRIPE_PAYMENT_LINK_LIFETIME',
    note: 'One payment. Permanent access.',
  },
]

function getWebPlanLink(plan) {
  const primary = import.meta.env[plan.linkEnv]
  if (primary) return primary
  if (plan.fallbackEnv) return import.meta.env[plan.fallbackEnv]
  return ''
}

export default function Subscribe() {
  const { user, refreshProfile, markSubscribed } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const nativeIap = usesNativeIap()

  async function handleSubscribe(plan = WEB_PLANS[0]) {
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

    // Web: redirect to the Stripe payment link for the selected plan.
    const link = getWebPlanLink(plan)
    if (!link) {
      console.warn(`${plan.linkEnv} is not set.`)
      setMessage(`The ${plan.label.toLowerCase()} plan is not configured yet.`)
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
            fontSize: 'var(--fs-sm)',
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

        {nativeIap ? (
          <button onClick={() => handleSubscribe()} className="subscribe-cta btn-press" disabled={busy}>
            {busy ? 'Please wait…' : 'See Plans'}
          </button>
        ) : (
          <div className="subscribe-plan-list">
            {WEB_PLANS.map((plan) => {
              const configured = Boolean(getWebPlanLink(plan))
              return (
                <div key={plan.key} className={`subscribe-price-box${configured ? '' : ' subscribe-price-box--disabled'}`}>
                  <div className="subscribe-plan-header">
                    <div className="subscribe-plan-label-row">
                      <p className="subscribe-plan-label">{plan.label}</p>
                      {plan.badge && <span className="subscribe-plan-badge">{plan.badge}</span>}
                    </div>
                    <div className="subscribe-price-row">
                      <span className="subscribe-price">{plan.price}</span>
                      <span className="subscribe-price-unit">{plan.unit}</span>
                    </div>
                  </div>
                  <p className="subscribe-fine-print">{plan.note}</p>
                  <button
                    onClick={() => handleSubscribe(plan)}
                    className="subscribe-cta btn-press"
                    disabled={busy || !configured}
                  >
                    {busy ? 'Please wait…' : configured ? plan.cta : 'Coming soon'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

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
