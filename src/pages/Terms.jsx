import BackButton from '../components/BackButton'
import { openExternalUrlInApp } from '../lib/inAppBrowser'
import './Privacy.css'

const LAST_UPDATED = 'September 6, 2026'
const CONTACT_EMAIL = 'jettuf26@gmail.com'
const OPERATOR = 'Jett Nguyen'
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
        <h2>Who We Are</h2>
        <p>
          Tempify is operated by {OPERATOR}, an individual based in Florida, United States
          (&ldquo;Tempify&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). These terms are an agreement
          between you and {OPERATOR}.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Accounts</h2>
        <ul>
          <li>You must provide accurate information when creating an account.</li>
          <li>You are responsible for keeping your account credentials secure.</li>
          <li>You must be at least 13 years old to create an account, or older where your country sets a higher minimum age for online services.</li>
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
          <li>If we change the price of a renewing plan, we will give you notice before it takes effect so you can cancel before the next renewal.</li>
          <li>Where a free trial is offered, it converts to a paid subscription unless you cancel before the trial ends.</li>
          <li>Refunds are handled by Apple or Stripe under their own policies.</li>
          <li>If you are a consumer in the European Economic Area or the United Kingdom, you normally have 14 days to withdraw from a digital purchase. By starting to use Tempify+ straight away you ask us to begin immediately and accept that the right to withdraw is lost once the service has been fully performed. Purchases made through the App Store are handled under Apple&rsquo;s own refund process.</li>
        </ul>
      </section>

      <section className="privacy-section">
        <h2>Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the app to cheat, manipulate scores, or disrupt leaderboards.</li>
          <li>Attempt to reverse engineer, scrape, or exploit the service.</li>
          <li>Use usernames or profile content that is offensive or violates others&rsquo; rights.</li>
        </ul>
      </section>

      <section className="privacy-section">
        <h2>Your Content</h2>
        <p>
          You keep ownership of what you submit — your username, avatar choices, and anything else you
          add to your profile. You grant us a non-exclusive, worldwide, royalty-free licence to store
          and display that content within Tempify so the service can work as intended, for as long as
          you keep it on your account. That licence ends when you remove the content or delete your
          account. You confirm you have the right to submit what you submit, and we may remove content
          that breaks these terms.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Content and Copyright</h2>
        <p>
          All puzzle content, audio previews, and game data are provided for personal,
          non-commercial use only. Song metadata and audio previews are retrieved through the Deezer
          API and remain the property of their respective rights holders. Tempify claims no ownership
          of the music it references.
        </p>
        <p>
          If you are a rights holder and believe material on Tempify infringes your copyright, email{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            onClick={(e) => { e.preventDefault(); openExternalUrlInApp(`mailto:${CONTACT_EMAIL}`) }}
          >{CONTACT_EMAIL}</a> with:
        </p>
        <ul>
          <li>Identification of the work you say is infringed.</li>
          <li>Identification of the material on Tempify and where to find it.</li>
          <li>Your name, address, and contact details.</li>
          <li>A statement that you believe in good faith the use is not authorised by the rights holder or the law.</li>
          <li>A statement, under penalty of perjury, that your notice is accurate and that you are the rights holder or authorised to act for them.</li>
          <li>Your physical or electronic signature.</li>
        </ul>
        <p>
          We will review complete notices promptly, remove or disable infringing material where
          appropriate, and terminate the accounts of repeat infringers.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Use of AI</h2>
        <p>
          Artificial intelligence tools were used in building Tempify and are used in running it. AI
          coding tools helped write and review the software, AI tools assist in preparing puzzle
          content such as shortlisting tracks and drafting hints and copy, and an AI assistant may
          help draft replies to support emails. A human reviews puzzle content before it is published
          and reviews support replies before they are sent.
        </p>
        <p>
          AI-assisted content can still contain errors. Puzzle content is provided as-is, and nothing
          in Tempify — including anything produced with AI assistance — is professional advice of any
          kind. How AI interacts with your personal data is described in our Privacy Policy.
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
          Tempify is provided as-is, without warranties of any kind, express or implied, including
          any implied warranties of merchantability, fitness for a particular purpose, and
          non-infringement. We do not guarantee uninterrupted access, that a puzzle will be available
          every day, or that the service will be error-free. To the extent permitted by law, we are
          not liable for any loss of data or gameplay progress resulting from service interruptions.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, we are not liable for any indirect, incidental,
          special, consequential, or punitive damages, or for lost profits, data, or goodwill, arising
          out of your use of Tempify. Our total liability for any claim relating to Tempify will not
          exceed the greater of the amount you paid us in the twelve months before the claim arose, or
          fifty United States dollars.
        </p>
        <p>
          Some jurisdictions do not allow the exclusion of certain warranties or the limitation of
          certain damages, so parts of this section and the section above may not apply to you.
          Nothing in these terms limits liability for fraud, for death or personal injury caused by
          negligence, or for anything else that cannot be limited by law. If you are a consumer, these
          terms do not affect your statutory rights.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Indemnity</h2>
        <p>
          You agree to indemnify and hold harmless {OPERATOR} from any claim, loss, or demand,
          including reasonable legal fees, arising out of your use of Tempify, the content you submit,
          or your breach of these terms. This does not apply to the extent the claim arises from our
          own conduct.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Governing Law and Disputes</h2>
        <p>
          These terms are governed by the laws of the State of Florida, United States, without regard
          to its conflict-of-laws rules. You and we agree that any dispute will be brought exclusively
          in the state or federal courts located in Florida, and we each consent to their
          jurisdiction.
        </p>
        <p>
          If you are a consumer resident in the European Economic Area or the United Kingdom, this
          does not deprive you of the protection of the mandatory laws of your country of residence,
          and you may bring proceedings there.
        </p>
      </section>

      <section className="privacy-section">
        <h2>General</h2>
        <ul>
          <li>If any part of these terms is found unenforceable, the rest stays in force.</li>
          <li>Not enforcing a term at one time does not waive our right to enforce it later.</li>
          <li>These terms, together with the Privacy Policy, are the entire agreement between you and us about Tempify.</li>
          <li>You may not transfer your rights under these terms. We may transfer ours if Tempify changes hands, provided your rights are not reduced.</li>
        </ul>
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
          Use of the Tempify iOS app is also governed by Apple&rsquo;s standard End User License
          Agreement (EULA). You can read it at{' '}
          <a
            href={EULA_URL}
            onClick={(e) => { e.preventDefault(); openExternalUrlInApp(EULA_URL) }}
          >
            apple.com/legal/internet-services/itunes/dev/stdeula
          </a>. Apple is not a party to these terms and is not responsible for Tempify or its content,
          but Apple is a third-party beneficiary of them and may enforce them against you. Apple has
          no obligation to provide support or maintenance for Tempify, and any claim about the app
          being defective is between you and us, not Apple.
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
