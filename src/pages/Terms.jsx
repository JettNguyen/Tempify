import BackButton from '../components/BackButton'
import { openExternalUrlInApp } from '../lib/inAppBrowser'
import './Privacy.css'

const LAST_UPDATED = 'September 5, 2026'
const CONTACT_EMAIL = 'jettuf26@gmail.com'
const EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'

export default function Terms() {
  return (
    <div className="page-shell-narrow">
      <BackButton className="privacy-back" fallbackTo="/">← Back</BackButton>

      <header className="privacy-header">
        <p className="privacy-eyebrow">legal</p>
        <h1 className="privacy-title">Terms of Service</h1>
        <p className="privacy-updated">Last updated: {LAST_UPDATED}</p>
      </header>

      <section className="privacy-section">
        <h2>Overview</h2>
        <p>
          By using Tempify — on the web or in the iOS app — you agree to these terms. If you do not
          agree, please do not use the app.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Accounts</h2>
        <ul>
          <li>You must provide accurate information when creating an account.</li>
          <li>You are responsible for keeping your account credentials secure.</li>
          <li>You must be at least 13 years old to create an account.</li>
          <li>One person, one account. Accounts created to manipulate leaderboards may be removed.</li>
        </ul>
      </section>

      <section className="privacy-section">
        <h2>Tempify+</h2>
        <p>
          Tempify+ unlocks the full puzzle archive, the global leaderboard, monthly streak freezes,
          and a profile badge. Current prices and terms are shown before you purchase.
        </p>
        <ul>
          <li>Monthly and yearly plans renew automatically at the end of each period until cancelled.</li>
          <li>The lifetime plan is a single payment. It does not renew and there is nothing to cancel.</li>
          <li>Purchases are handled by the App Store on iOS and by Stripe on the web.</li>
          <li>Auto-renewing plans can be cancelled at any time — through your App Store account for iOS purchases, or the billing portal for web purchases. Cancelling stops future charges; access continues until the end of the period you have paid for.</li>
          <li>Refunds are handled by Apple or Stripe under their own policies.</li>
        </ul>
      </section>

      <section className="privacy-section">
        <h2>Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the app to cheat, manipulate scores, or disrupt leaderboards.</li>
          <li>Attempt to reverse engineer, scrape, or exploit the service.</li>
          <li>Use usernames or profile content that is offensive or violates others' rights.</li>
        </ul>
      </section>

      <section className="privacy-section">
        <h2>Content</h2>
        <p>
          All puzzle content, audio previews, and game data are provided for personal,
          non-commercial use only. Song metadata and audio previews are retrieved through the Deezer
          API and remain the property of their respective rights holders. Tempify claims no ownership
          of the music it references.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Termination</h2>
        <p>
          We reserve the right to suspend or terminate accounts that violate these terms. You may
          delete your account at any time from the profile screen. Deleting your account does not
          automatically cancel a subscription billed by Apple or Stripe — cancel that separately.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Disclaimers</h2>
        <p>
          Tempify is provided as-is, without warranties of any kind. We do not guarantee
          uninterrupted access, that a puzzle will be available every day, or that the service will
          be error-free. To the extent permitted by law, we are not liable for any loss of data or
          gameplay progress resulting from service interruptions.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Changes to These Terms</h2>
        <p>
          We may update these terms as the app changes. When we do, we will revise the date at the
          top of this page. Continuing to use Tempify after an update means you accept the revised
          terms.
        </p>
      </section>

      <section className="privacy-section">
        <h2>iOS App License</h2>
        <p>
          Use of the Tempify iOS app is also governed by Apple's standard End User License Agreement
          (EULA). You can read it at{' '}
          <a
            href={EULA_URL}
            onClick={(e) => { e.preventDefault(); openExternalUrlInApp(EULA_URL) }}
          >
            apple.com/legal/internet-services/itunes/dev/stdeula
          </a>.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Contact</h2>
        <p>
          For questions about these terms, email{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            onClick={(e) => { e.preventDefault(); openExternalUrlInApp(`mailto:${CONTACT_EMAIL}`) }}
          >{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </div>
  )
}
