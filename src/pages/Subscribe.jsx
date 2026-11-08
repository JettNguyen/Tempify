import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { openExternalUrlInApp } from '../lib/inAppBrowser'
import { usesNativeIap, getPlans, buyPlan, restorePurchases } from '../lib/billing'
import { planCards, anyRenews } from '../lib/plans'
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

  // The App Store's plans, read from RevenueCat: null while loading.
  const [plans, setPlans] = useState(null)
  const [plansFailed, setPlansFailed] = useState(false)
  const [buying, setBuying] = useState(null)

  async function loadPlans() {
    setPlans(null)
    setPlansFailed(false)
    try {
      setPlans(planCards(await getPlans()))
    } catch (err) {
      console.warn('[Subscribe] Plans failed to load', err)
      setPlans([])
      setPlansFailed(true)
    }
  }

  useEffect(() => {
    if (nativeIap) loadPlans()
  }, [nativeIap])

  async function handleBuy(plan) {
    if (busy) return
    setBusy(true)
    setBuying(plan.key)
    setMessage('')
    try {
      const outcome = await buyPlan(plan.pkg)
      if (outcome === 'active') {
        await markSubscribed()
        navigate('/archive')
      } else if (outcome === 'pending') {
        setMessage("Apple is still confirming this purchase. Tempify+ turns on as soon as it goes through, and Refresh status checks again.")
      }
      // Cancelled: the player backed out, so say nothing.
    } catch (err) {
      console.warn('[Subscribe] Purchase failed', err)
      setMessage("The purchase didn't go through, and you weren't charged. Try again, or check the payment method on your Apple account.")
    } finally {
      setBusy(false)
      setBuying(null)
    }
  }

  async function handleSubscribe(plan) {
    if (busy) return
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

  // Re-runs the whole profile read: the RevenueCat entitlement check, the
  // Stripe flag on the row, and the email allowlist. Useful when a purchase
  // or a comp landed after this session started and the app has not noticed.
  async function handleRefresh() {
    if (busy || !user) return
    setBusy(true)
    setMessage('')
    try {
      const fresh = await refreshProfile()
      setMessage(fresh?.is_subscribed
        ? 'Tempify+ is active on this account.'
        : 'No active subscription found on this account.')
    } catch (err) {
      setMessage(err?.message || 'Unable to check your status right now.')
    } finally {
      setBusy(false)
    }
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
          Unlock the full archive, browse by genre, make games for your friends from songs
          you pick, and get recommendations based on what you actually play. Streaks carry
          across every game.
        </p>

        {nativeIap ? (
          <NativePlans
            plans={plans}
            failed={plansFailed}
            busy={busy}
            buying={buying}
            onBuy={handleBuy}
            onRetry={loadPlans}
          />
        ) : (
          <div className="subscribe-plan-list">
            {WEB_PLANS.map((plan) => {
              const configured = Boolean(getWebPlanLink(plan))
              return (
                <PlanBox
                  key={plan.key}
                  plan={plan}
                  disabled={busy || !configured}
                  dim={!configured}
                  cta={busy ? 'Please wait…' : configured ? plan.cta : 'Coming soon'}
                  onClick={() => handleSubscribe(plan)}
                />
              )
            })}
          </div>
        )}

        {nativeIap && (
          <button onClick={handleRestore} className="subscribe-restore btn-press btn-hover" disabled={busy}>
            Restore purchases
          </button>
        )}

        {/* Not gated on nativeIap: a web subscription or a comped account can
            go stale here too, and restore only ever speaks to the App Store. */}
        {user && (
          <button onClick={handleRefresh} className="subscribe-restore btn-press btn-hover" disabled={busy}>
            {busy ? 'Checking…' : 'Refresh status'}
          </button>
        )}

        {message && <p className="subscribe-hint subscribe-hint--message">{message}</p>}

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

function PlanBox({ plan, cta, disabled, dim = false, onClick }) {
  return (
    <div className={`subscribe-price-box${dim ? ' subscribe-price-box--disabled' : ''}`}>
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
      <button onClick={onClick} className="subscribe-cta btn-press" disabled={disabled}>
        {cta}
      </button>
    </div>
  )
}

// The App Store's plans, in the same cards the web shows.
function NativePlans({ plans, failed, busy, buying, onBuy, onRetry }) {
  if (plans === null) {
    return (
      <div className="subscribe-plan-list" aria-busy="true" aria-label="Loading plans">
        {[0, 1, 2].map((i) => <div key={i} className="subscribe-price-box subscribe-price-box--loading" />)}
      </div>
    )
  }

  if (plans.length === 0) {
    return (
      <div className="subscribe-plans-missing">
        <p className="subscribe-hint">
          {failed
            ? "Couldn't load the plans. Check your connection, then try again."
            : 'No plans are showing right now. Try again in a minute.'}
        </p>
        <button onClick={onRetry} className="subscribe-restore btn-press btn-hover">Try again</button>
      </div>
    )
  }

  return (
    <>
      <div className="subscribe-plan-list">
        {plans.map((plan) => (
          <PlanBox
            key={plan.key}
            plan={plan}
            disabled={busy}
            cta={buying === plan.key ? 'Please wait…' : plan.cta}
            onClick={() => onBuy(plan)}
          />
        ))}
      </div>
      {anyRenews(plans) && (
        <p className="subscribe-renews">
          Monthly and yearly plans renew on their own until you cancel. You can cancel any time in
          your iPhone's Settings, under your name, then Subscriptions.
        </p>
      )}
    </>
  )
}
