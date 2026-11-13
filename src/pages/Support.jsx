import { Link } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { openExternalUrlInApp } from '../lib/inAppBrowser'
import './Privacy.css'

const SUPPORT_EMAIL = 'support@tempify.me'
// The Stripe page Profile's Manage billing button opens, where a web purchase
// is changed or canceled.
const BILLING_URL = import.meta.env.VITE_STRIPE_CUSTOMER_PORTAL_URL

/** A link that leaves Tempify: Mail, or a page in the app's own browser. */
function OutLink({ href, children }) {
  return (
    <a href={href} onClick={(e) => { e.preventDefault(); openExternalUrlInApp(href) }}>
      {children}
    </a>
  )
}

export default function Support() {
  return (
    <div className="page-shell-narrow">
      <BackButton className="privacy-back" fallbackTo="/">← Back</BackButton>

      <header className="privacy-header">
        <p className="privacy-eyebrow">help</p>
        <h1 className="privacy-title">Support</h1>
      </header>

      <section className="privacy-section">
        <h2>Write to us</h2>
        <p>
          Email <OutLink href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</OutLink> with a problem, a
          question about Tempify+, or an idea for a game.
        </p>
      </section>

      <section className="privacy-section">
        <h2>What to tell us</h2>
        <ul>
          <li>The device you play on, like an iPhone 15, or the browser, like Chrome on a laptop.</li>
          <li>
            The app version, if you play in the iPhone app. It&rsquo;s in Settings, under General, then
            iPhone Storage, then Tempify.
          </li>
          <li>What happened, and what you were doing right before. A screenshot helps.</li>
        </ul>
      </section>

      <section className="privacy-section">
        <h2>Change or cancel Tempify+</h2>
        <p>It depends on where you bought it.</p>
        <ul>
          <li>On iPhone: open Settings, tap your name at the top, then Subscriptions, then Tempify.</li>
          {BILLING_URL ? (
            <li>
              On the web: open the <OutLink href={BILLING_URL}>billing page</OutLink> and sign in with
              the email you paid with.
            </li>
          ) : (
            <li>On the web: email us from the address you paid with.</li>
          )}
        </ul>
        <p>The lifetime plan is paid once, so there&rsquo;s nothing to cancel.</p>
      </section>

      <section className="privacy-section">
        <h2>Delete your account</h2>
        <p>
          Sign in, open your <Link to="/profile">Profile</Link>, and tap Delete account at the bottom.
          That deletes your account, scores, streaks and profile, and it can&rsquo;t be undone.
        </p>
        <ul>
          <li>Deleting your account doesn&rsquo;t cancel Tempify+. Cancel it as well, the way it says above.</li>
          <li>Can&rsquo;t sign in? Email us from the address on your account and say you want it deleted.</li>
        </ul>
      </section>

      <section className="privacy-section">
        <h2>Privacy and terms</h2>
        <p>
          How Tempify handles your data is in the <Link to="/privacy">Privacy Policy</Link>, and the
          rules for using it are in the <Link to="/terms">Terms of Service</Link>.
        </p>
      </section>
    </div>
  )
}
