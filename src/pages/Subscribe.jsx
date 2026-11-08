import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { openExternalUrlInApp } from '../lib/inAppBrowser'
import { usesNativeIap, getPlans, buyPlan, restorePurchases } from '../lib/billing'
import { planCards, startingPlan } from '../lib/plans'
import './Subscribe.css'

const PERKS = [
  'Every past day of every game',
  'Browse by genre',
  'Make games for friends from songs you pick',
  'Recommendations based on what you play',
  'Streaks that carry across every game',
]

// The web's plans, paid through Stripe links. Same shape as planCards().
const WEB_PLANS = [
  {
    key: 'yearly',
    label: 'Yearly',
    price: '$25',
    unit: '/ year',
    badge: 'Save 31%',
    detail: '$2.08 a month, billed once a year',
    cta: 'Subscribe for $25 a year',
    linkEnv: 'VITE_STRIPE_PAYMENT_LINK_YEARLY',
  },
  {
    key: 'monthly',
    label: 'Monthly',
    price: '$3',
    unit: '/ month',
    detail: 'Billed every month. Cancel any time.',
    cta: 'Subscribe for $3 a month',
    linkEnv: 'VITE_STRIPE_PAYMENT_LINK_MONTHLY',
    fallbackEnv: 'VITE_STRIPE_PAYMENT_LINK',
  },
  {
    key: 'lifetime',
    label: 'Lifetime',
    price: '$100',
    unit: 'once',
    detail: 'Pay once and keep it',
    cta: 'Buy lifetime for $100',
    linkEnv: 'VITE_STRIPE_PAYMENT_LINK_LIFETIME',
  },
]

function getWebPlanLink(plan) {
  const primary = import.meta.env[plan.linkEnv]
  if (primary) return primary
  if (plan.fallbackEnv) return import.meta.env[plan.fallbackEnv]
  return ''
}

const webPlans = () => WEB_PLANS.map((plan) => ({ ...plan, unavailable: !getWebPlanLink(plan) }))

export default function Subscribe() {
  const { user, refreshProfile, markSubscribed } = useAuth()
  const navigate = useNavigate()
  const nativeIap = usesNativeIap()

  // What's in flight: 'buy', 'restore' or 'refresh'.
  const [doing, setDoing] = useState(null)
  const busy = doing !== null
  const [message, setMessage] = useState('')

  // The plans: the web's own, or the App Store's from RevenueCat (null while
  // they load).
  const [plans, setPlans] = useState(() => (nativeIap ? null : webPlans()))
  const [plansFailed, setPlansFailed] = useState(false)
  const [chosen, setChosen] = useState(() => (nativeIap ? null : startingPlan(webPlans().filter((p) => !p.unavailable))))
  const chosenPlan = plans?.find((plan) => plan.key === chosen) || null

  async function loadPlans() {
    setPlans(null)
    setPlansFailed(false)
    try {
      const cards = planCards(await getPlans())
      setPlans(cards)
      setChosen((current) => (cards.some((card) => card.key === current) ? current : startingPlan(cards)))
    } catch (err) {
      console.warn('[Subscribe] Plans failed to load', err)
      setPlans([])
      setPlansFailed(true)
    }
  }

  useEffect(() => {
    if (nativeIap) loadPlans()
  }, [nativeIap])

  function choose(key) {
    if (busy) return
    setChosen(key)
    setMessage('')
  }

  async function handleBuy() {
    if (busy || !chosenPlan || chosenPlan.unavailable) return
    setMessage('')

    if (!nativeIap) {
      // Web: off to the Stripe payment link for the chosen plan.
      const url = new URL(getWebPlanLink(chosenPlan))
      if (user?.email) url.searchParams.set('prefilled_email', user.email)
      await openExternalUrlInApp(url.toString())
      return
    }

    setDoing('buy')
    try {
      const outcome = await buyPlan(chosenPlan.pkg)
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
      setDoing(null)
    }
  }

  // Re-runs the whole profile read: the RevenueCat entitlement check, the
  // Stripe flag on the row, and the email allowlist. Useful when a purchase
  // or a comp landed after this session started and the app has not noticed.
  async function handleRefresh() {
    if (busy || !user) return
    setDoing('refresh')
    setMessage('')
    try {
      const fresh = await refreshProfile()
      setMessage(fresh?.is_subscribed
        ? 'Tempify+ is active on this account.'
        : 'No active subscription found on this account.')
    } catch (err) {
      setMessage(err?.message || 'Unable to check your status right now.')
    } finally {
      setDoing(null)
    }
  }

  async function handleRestore() {
    if (busy || !nativeIap) return
    setDoing('restore')
    setMessage('')
    try {
      const restored = await restorePurchases()
      await refreshProfile()
      setMessage(restored ? 'Purchases restored!' : 'No active subscription found to restore.')
    } catch (err) {
      setMessage(err?.message || 'Unable to restore purchases right now.')
    } finally {
      setDoing(null)
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

        <ul className="subscribe-perks">
          {PERKS.map((perk) => (
            <li key={perk} className="subscribe-perk">
              <svg className="subscribe-perk__check" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {perk}
            </li>
          ))}
        </ul>

        {plans === null ? (
          <div className="subscribe-plans" aria-busy="true" aria-label="Loading plans">
            {[0, 1, 2].map((i) => <div key={i} className="subscribe-plan subscribe-plan--loading" style={{ '--i': i }} />)}
          </div>
        ) : plans.length === 0 ? (
          <div className="subscribe-plans-missing">
            <p className="subscribe-hint">
              {plansFailed
                ? "Couldn't load the plans. Check your connection, then try again."
                : 'No plans are showing right now. Try again in a minute.'}
            </p>
            <button onClick={loadPlans} className="subscribe-secondary btn-press">Try again</button>
          </div>
        ) : (
          <PlanPicker plans={plans} chosen={chosen} onChoose={choose} />
        )}

        {plans?.length !== 0 && (
          <button
            onClick={handleBuy}
            className="subscribe-buy btn-press"
            disabled={busy || !chosenPlan || chosenPlan.unavailable}
          >
            {doing === 'buy'
              ? 'Please wait…'
              : chosenPlan?.unavailable
                ? 'Coming soon'
                : chosenPlan?.cta || 'Subscribe'}
          </button>
        )}

        {nativeIap && chosenPlan?.renews && (
          <p className="subscribe-renews">
            {chosenPlan.renews} You can cancel any time in your iPhone's Settings, under your name,
            then Subscriptions.
          </p>
        )}

        {message && <p className="subscribe-hint subscribe-hint--message">{message}</p>}

        {!user && (
          <p className="subscribe-hint">You'll be asked to log in or create an account.</p>
        )}

        <div className="subscribe-more">
          {nativeIap && (
            <button onClick={handleRestore} className="subscribe-text-btn" disabled={busy}>
              {doing === 'restore' ? 'Restoring…' : 'Restore purchases'}
            </button>
          )}
          {/* Not gated on nativeIap: a web subscription or a comped account can
              go stale here too, and restore only ever speaks to the App Store. */}
          {user && (
            <button onClick={handleRefresh} className="subscribe-text-btn" disabled={busy}>
              {doing === 'refresh' ? 'Checking…' : 'Refresh status'}
            </button>
          )}
        </div>

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

// One plan is chosen at a time, and the button under the list buys it.
function PlanPicker({ plans, chosen, onChoose }) {
  return (
    <div className="subscribe-plans" role="radiogroup" aria-label="Plans">
      {plans.map((plan, i) => {
        const on = plan.key === chosen
        return (
          <button
            key={plan.key}
            type="button"
            role="radio"
            aria-checked={on}
            className={`subscribe-plan${on ? ' subscribe-plan--on' : ''}`}
            style={{ '--i': i }}
            disabled={plan.unavailable}
            onClick={() => onChoose(plan.key)}
          >
            <span className="subscribe-plan__dot" aria-hidden="true" />
            <span className="subscribe-plan__text">
              <span className="subscribe-plan__name">
                {plan.label}
                {plan.badge && <span className="subscribe-plan__badge">{plan.badge}</span>}
              </span>
              <span className="subscribe-plan__detail">{plan.unavailable ? 'Coming soon' : plan.detail}</span>
            </span>
            <span className="subscribe-plan__price">
              {plan.price}
              <span className="subscribe-plan__unit">{plan.unit}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
