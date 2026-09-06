import { Link } from 'react-router-dom'
import Icon from './Icon'
import './DailyCompleteCta.css'

// Where someone goes after finishing the day depends on what they can already
// reach: the archive if they're subscribed, the paywall if not, and an account
// first if they've been playing as a guest.
function copyFor({ user, isSubscribed }) {
  if (!user) {
    return {
      body: 'Create an account to keep your streaks and open up every past puzzle.',
      cta: 'Create account',
      to: '/signup',
    }
  }
  if (!isSubscribed) {
    return {
      body: 'Tempify+ opens the archive, so you can play any day you missed.',
      cta: 'Unlock the archive',
      to: '/subscribe',
    }
  }
  return {
    body: 'Pick any past day from the archive and keep playing.',
    cta: 'Browse the archive',
    to: '/explore',
  }
}

export default function DailyCompleteCta({ user, isSubscribed }) {
  const { body, cta, to } = copyFor({ user, isSubscribed })

  return (
    <section className="daily-cta slide-up">
      <span className="daily-cta__badge">
        <Icon name="check" size={15} strokeWidth={2.5} />
      </span>

      <div className="daily-cta__text">
        <p className="daily-cta__title">That's every game today</p>
        <p className="daily-cta__body">{body}</p>
      </div>

      <Link to={to} className="daily-cta__action btn-press">
        {cta}
      </Link>
    </section>
  )
}
