import BackButton from '../components/BackButton'
import { openExternalUrlInApp } from '../lib/inAppBrowser'
import './Privacy.css'

const LAST_UPDATED = 'September 6, 2026'
const CONTACT_EMAIL = 'jettuf26@gmail.com'
const OPERATOR = 'Jett Nguyen'

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
        <h2>Who We Are</h2>
        <p>
          Tempify is operated by {OPERATOR}, an individual based in Florida, United States
          (&ldquo;Tempify&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). For the purposes of the GDPR
          and the UK GDPR, {OPERATOR} is the data controller for the personal data described here.
          You can reach us at any time at{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            onClick={(e) => { e.preventDefault(); openExternalUrlInApp(`mailto:${CONTACT_EMAIL}`) }}
          >{CONTACT_EMAIL}</a>.
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
          <li>Technical data logged automatically by our hosting and backend providers, such as your IP address, device or browser type, and request timestamps. This is used to keep the service running, diagnose faults, and prevent abuse.</li>
        </ul>
        <p>
          We do not collect payment card details. Payments are handled entirely by Apple or Stripe.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Data Stored on Your Device</h2>
        <p>
          Tempify stores some data locally in your browser or app so it works without an account and
          survives a refresh. This includes your progress on the current day&rsquo;s puzzles, which
          puzzles you have completed, game timers, a cached subscription flag, and a cache of album
          artwork lookups. This data stays on your device, is not sent to us, and is cleared when you
          clear your browser or app storage. We do not use cookies for advertising or analytics.
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
        <h2>Legal Bases for Processing</h2>
        <p>
          If you are in the European Economic Area or the United Kingdom, we rely on the following
          legal bases:
        </p>
        <ul>
          <li>Performance of a contract — creating and running your account, saving your progress, and providing Tempify+ features you have paid for.</li>
          <li>Legitimate interests — keeping the service secure, preventing cheating and abuse, and understanding and fixing faults.</li>
          <li>Consent — optional choices you make, such as setting a username or making your scores visible on leaderboards. You can withdraw consent at any time by changing the setting or deleting your account.</li>
          <li>Legal obligation — keeping records we are required to keep, such as those relating to purchases and tax.</li>
        </ul>
      </section>

      <section className="privacy-section">
        <h2>Use of AI</h2>
        <p>
          We think you should know where artificial intelligence sits in this product.
        </p>
        <ul>
          <li>AI coding tools were used to help write and review the software that runs Tempify.</li>
          <li>AI tools assist in preparing puzzle content, such as shortlisting tracks and drafting hints and copy. A human reviews puzzle content before it is published, but mistakes can still get through.</li>
          <li>If you email us for support, an AI assistant may help draft the reply, and the content of your message may be processed by that assistant for that purpose. A human reviews replies before they are sent. Please do not include passwords or payment details in support emails.</li>
        </ul>
        <p>
          Your account details and gameplay data are not used to train AI models, and no AI system
          makes automated decisions about you that produce legal or similarly significant effects.
        </p>
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
        <h2>International Transfers</h2>
        <p>
          Tempify is operated from the United States, and our providers may store and process data in
          the United States and in other countries where they operate. If you are in the European
          Economic Area or the United Kingdom, this means your personal data may be transferred
          outside your home country. Where that happens we rely on the safeguards our providers put
          in place, such as the European Commission&rsquo;s Standard Contractual Clauses and the UK
          International Data Transfer Addendum.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Security</h2>
        <p>
          Traffic between your device and our providers is encrypted in transit. Passwords are hashed
          and stored by Supabase and are never visible to us, and database access is restricted by
          row-level security rules so one account cannot read another&rsquo;s private data. We never
          receive or store payment card details. No service can promise perfect security, and you use
          Tempify knowing that. If a breach affects your personal data, we will notify you and the
          relevant regulators where the law requires it.
        </p>
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
          associated data at any time from the Profile screen. Deletion cannot be undone. Residual
          copies may remain in encrypted provider backups for a short period, normally no more than
          30 days, after which they are overwritten. Records we are legally required to keep, such as
          purchase records, are kept for as long as the law requires.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Your Rights</h2>
        <p>
          Depending on where you live, you may have some or all of the following rights over your
          personal data:
        </p>
        <ul>
          <li>Access — ask for a copy of the personal data we hold about you.</li>
          <li>Correction — ask us to fix data that is wrong or incomplete.</li>
          <li>Deletion — ask us to erase your data, which you can also do yourself from the Profile screen.</li>
          <li>Portability — ask for your data in a portable, machine-readable format.</li>
          <li>Restriction and objection — ask us to pause or stop certain processing, including processing based on legitimate interests.</li>
          <li>Withdraw consent — for anything you agreed to optionally, without affecting what happened before you withdrew.</li>
        </ul>
        <p>
          To exercise any of these, email{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            onClick={(e) => { e.preventDefault(); openExternalUrlInApp(`mailto:${CONTACT_EMAIL}`) }}
          >{CONTACT_EMAIL}</a>. We will respond within 30 days, and we will not charge you or treat
          you differently for asking. If you are in the EEA or the UK and you are unhappy with our
          response, you can complain to your local supervisory authority, or to the Information
          Commissioner&rsquo;s Office in the UK.
        </p>
      </section>

      <section className="privacy-section">
        <h2>California Privacy Rights</h2>
        <p>
          If you are a California resident, the CCPA as amended by the CPRA gives you the right to
          know what personal information we collect and why, to access and delete it, to correct
          inaccurate information, and not to be discriminated against for exercising those rights.
          In the past 12 months we have collected the categories described under Data We Collect:
          identifiers, commercial information relating to subscriptions, internet and device activity,
          and the profile content you choose to provide.
        </p>
        <p>
          We do not sell personal information, and we do not share it for cross-context behavioural
          advertising, as those terms are defined by California law. We have never done so, including
          for users we know to be under 16. We do not collect sensitive personal information for the
          purpose of inferring characteristics about you. To make a request, email us at the address
          above; you may use an authorised agent, and we may need to verify your identity first.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Children</h2>
        <p>
          Tempify is not directed to children under 13, and accounts are limited to users 13 and
          older. If you are in the European Economic Area or the United Kingdom, the minimum age for
          consenting to online services in your country may be higher than 13 — up to 16 — and you
          should not create an account unless you meet it. If you believe a child below the
          applicable age has created an account, contact us and we will delete it.
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
