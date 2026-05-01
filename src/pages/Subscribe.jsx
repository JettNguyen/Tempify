import { useAuth } from '../hooks/useAuth'
import { openExternalUrlInApp } from '../lib/inAppBrowser'
import './Subscribe.css'

export default function Subscribe() {
  const { user } = useAuth()

  async function handleSubscribe() {
    const link = import.meta.env.VITE_STRIPE_PAYMENT_LINK
    if (!link) {
      console.warn('VITE_STRIPE_PAYMENT_LINK is not set.')
      return
    }
    const url = new URL(link)
    if (user?.email) url.searchParams.set('prefilled_email', user.email)
    await openExternalUrlInApp(url.toString())
  }

  return (
    <div className="subscribe-page">
      <div className="subscribe-card">
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

        <button onClick={handleSubscribe} className="subscribe-cta btn-press">
          Subscribe — $3/mo
        </button>

        {!user && (
          <p className="subscribe-hint">You'll be asked to log in or create an account.</p>
        )}
      </div>
    </div>
  )
}
