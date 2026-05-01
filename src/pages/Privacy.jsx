import { Link } from 'react-router-dom'
import './Privacy.css'

const LAST_UPDATED = 'May 1, 2026'

export default function Privacy() {
  return (
    <div className="page-shell-narrow">
      <Link to="/profile" className="privacy-back">← Back to profile</Link>

      <header className="privacy-header">
        <p className="privacy-eyebrow">legal</p>
        <h1 className="privacy-title">Privacy Policy</h1>
        <p className="privacy-updated">Last updated: {LAST_UPDATED}</p>
      </header>

      <section className="privacy-section">
        <h2>Overview</h2>
        <p>
          Tempify provides daily music games and optional account features like profiles, streaks,
          and leaderboards across both the web app and mobile app. This policy explains what data
          is collected, how it is used, and your choices.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Data We Collect</h2>
        <ul>
          <li>Account information, such as email and username.</li>
          <li>Profile preferences, such as avatar icon, avatar color, and visibility settings.</li>
          <li>Gameplay data, such as scores, attempts, completion status, time records, and streaks.</li>
          <li>Social data, such as follows and public profile details you choose to share.</li>
          <li>Subscription state for premium access and billing portal routing.</li>
        </ul>
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
        <h2>Third-Party Services</h2>
        <p>
          Tempify uses third-party providers for product functionality on both web and mobile.
          These services may process data needed to operate the service.
        </p>
        <ul>
          <li>Supabase (authentication, database, and backend services).</li>
          <li>Stripe (subscription and billing flows).</li>
          <li>Music metadata/audio preview providers used for puzzle content.</li>
        </ul>
      </section>

      <section className="privacy-section">
        <h2>Tracking and Ads</h2>
        <p>
          Tempify does not use email addresses for ad tracking or cross-app targeted advertising.
          Data is used to provide product features on web and mobile, not to run third-party ad targeting.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Data Retention</h2>
        <p>
          Account and gameplay data is retained as needed to provide app features and maintain
          your profile, scores, and history. You may request account deletion by contacting support.
        </p>
      </section>

      <section className="privacy-section">
        <h2>Your Choices</h2>
        <ul>
          <li>You can play without an account for basic daily gameplay on web and mobile.</li>
          <li>You can set your leaderboard visibility in profile settings.</li>
          <li>You can sign out at any time from the profile screen in the app or web interface.</li>
        </ul>
      </section>

      <section className="privacy-section">
        <h2>Contact</h2>
        <p>
          For privacy questions or account data requests, please contact support through the support
          channel listed in the App Store or the support link provided on the website.
        </p>
      </section>
    </div>
  )
}
