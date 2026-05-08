import { Link } from 'react-router-dom'
import './Privacy.css'

const LAST_UPDATED = 'May 6, 2026'

export default function Terms() {
  return (
    <div className="page-shell-narrow">
      <Link to="/profile" className="privacy-back">← Back to profile</Link>

      <header className="privacy-header">
        <p className="privacy-eyebrow">legal</p>
        <h1 className="privacy-title">Terms of Service</h1>
        <p className="privacy-updated">Last updated: {LAST_UPDATED}</p>
      </header>

      <section className="privacy-section">
        <h2>Overview</h2>
        <p>
          By using Tempify — on web or mobile — you agree to these terms. If you do not agree,
          please do not use the app.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Accounts</h2>
        <ul>
          <li>You must provide accurate information when creating an account.</li>
          <li>You are responsible for keeping your account credentials secure.</li>
          <li>You must be at least 13 years old to create an account.</li>
        </ul>
      </section>

      <section className="privacy-section">
        <h2>Subscriptions</h2>
        <ul>
          <li>Tempify+ is a paid subscription that unlocks the full puzzle archive and other premium features.</li>
          <li>Subscriptions are billed through the App Store (iOS) or Stripe (web) and renew automatically unless cancelled.</li>
          <li>You can manage or cancel your subscription at any time through your App Store account or billing portal.</li>
          <li>Refunds are handled by Apple or Stripe according to their respective policies.</li>
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
          non-commercial use only. Music previews are sourced through licensed APIs and
          remain the property of their respective rights holders.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Termination</h2>
        <p>
          We reserve the right to suspend or terminate accounts that violate these terms.
          You may delete your account at any time from the profile screen.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Disclaimers</h2>
        <p>
          Tempify is provided as-is. We do not guarantee uninterrupted access or that the
          service will be error-free. We are not liable for any loss of data or gameplay
          progress resulting from service interruptions.
        </p>
      </section>

      <section className="privacy-section">
        <h2>iOS App License</h2>
        <p>
          Use of the Tempify iOS app is also governed by Apple's standard End User License Agreement
          (EULA). You can read it at{' '}
          <a
            href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
            target="_blank"
            rel="noopener noreferrer"
          >
            apple.com/legal/internet-services/itunes/dev/stdeula
          </a>.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Contact</h2>
        <p>
          For questions about these terms, please contact support through the channel listed
          in the App Store or the support link provided on the website.
        </p>
      </section>
    </div>
  )
}
