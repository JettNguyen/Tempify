import BackButton from '../components/BackButton'
import { openExternalUrlInApp } from '../lib/inAppBrowser'
import './Privacy.css'

const LAST_UPDATED = 'September 5, 2026'
const CONTACT_EMAIL = 'jettuf26@gmail.com'

export default function Privacy() {
  return (
    <div className="page-shell-narrow">
      <BackButton className="privacy-back" fallbackTo="/">← Back</BackButton>

      <header className="privacy-header">
        <p className="privacy-eyebrow">legal</p>
        <h1 className="privacy-title">Privacy Policy</h1>
        <p className="privacy-updated">Last updated: {LAST_UPDATED}</p>
      </header>

      <section className="privacy-section">
        <h2>Overview</h2>
        <p>
          Tempify provides daily music games and optional account features like profiles, streaks,
          and leaderboards across both the web app and the iOS app. This policy explains what data
          is collected, how it is used, and your choices.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Data We Collect</h2>
        <ul>
          <li>Account information: your email address, and a username if you choose one. If you sign in with Apple or Google, we receive your email address from that provider.</li>
          <li>Profile preferences, such as avatar icon, avatar color, leaderboard visibility, autoplay, and competitive mode.</li>
          <li>Gameplay data, such as scores, attempts, completion status, times, and streaks.</li>
          <li>Social data, such as who you follow and the profile details you choose to make visible.</li>
          <li>Subscription state, used to unlock premium access and route you to the right billing portal.</li>
        </ul>
        <p>
          We do not collect payment card details. Payments are handled entirely by Apple or Stripe.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Data Stored on Your Device</h2>
        <p>
          Tempify stores some data locally in your browser or app so it works without an account and
          survives a refresh. This includes your progress on the current day's puzzles, which puzzles
          you have completed, game timers, a cached subscription flag, and a cache of album artwork
          lookups. This data stays on your device, is not sent to us, and is cleared when you clear
          your browser or app storage.
        </p>
      </section>

      <section className="privacy-section">
        <h2>How We Use Data</h2>
        <ul>
          <li>To run core gameplay features and save your progress.</li>
          <li>To power streak tracking, archive access, and leaderboards.</li>
          <li>To let you manage your profile and privacy settings.</li>
          <li>To support account security and prevent abuse.</li>
          <li>To support subscription features and billing management.</li>
        </ul>
      </section>

      <section className="privacy-section">
        <h2>What Other People Can See</h2>
        <p>
          If you set a username, your profile — username, avatar, and premium badge — can be found by
          other signed-in users through in-app search. Your scores appear on leaderboards according to
          the leaderboard visibility setting on your profile, which you can change at any time.
          Your email address is never shown to other users.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Third-Party Services</h2>
        <p>
          Tempify relies on the following providers to operate. Each processes only the data needed
          for its role.
        </p>
        <ul>
          <li>Supabase — authentication, database, and backend services.</li>
          <li>Sign in with Apple and Google Sign-In — optional account sign-in.</li>
          <li>Stripe — subscription and one-time purchases on the web.</li>
          <li>Apple and RevenueCat — in-app purchases and subscription status on iOS. Your account identifier is shared with RevenueCat so purchases stay tied to your account.</li>
          <li>Deezer — song search and audio previews for puzzle content, requested through our own proxy so your device does not contact Deezer directly.</li>
        </ul>
      </section>

      <section className="privacy-section">
        <h2>Tracking and Ads</h2>
        <p>
          Tempify contains no advertising, no analytics SDKs, and no third-party trackers. We do not
          sell your data, we do not share it for advertising, and we do not track you across other
          apps or websites.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Data Retention</h2>
        <p>
          Account and gameplay data is retained while your account exists, so that your profile,
          scores, and history remain available. You can permanently delete your account and its
          associated data at any time from the Profile screen. Deletion cannot be undone.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Children</h2>
        <p>
          Tempify is not directed to children under 13, and accounts are limited to users 13 and
          older. If you believe a child under 13 has created an account, contact us and we will
          delete it.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Your Choices</h2>
        <ul>
          <li>You can play the daily games without an account.</li>
          <li>You can set your leaderboard visibility in profile settings.</li>
          <li>You can sign out at any time from the profile screen.</li>
          <li>You can delete your account and all associated data from the profile screen.</li>
        </ul>
      </section>

      <section className="privacy-section">
        <h2>Changes to This Policy</h2>
        <p>
          We may update this policy as the app changes. When we do, we will revise the date at the
          top of this page. Continuing to use Tempify after an update means you accept the revised
          policy.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Contact</h2>
        <p>
          For privacy questions or account data requests, email{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            onClick={(e) => { e.preventDefault(); openExternalUrlInApp(`mailto:${CONTACT_EMAIL}`) }}
          >{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </div>
  )
}
