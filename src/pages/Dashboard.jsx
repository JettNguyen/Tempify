import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getRecentScores, getStreaks } from '../lib/scores'
import StreakDisplay from '../components/StreakDisplay'
import './Dashboard.css'

const GAME_NAMES = {
  'one-bar': 'One Bar',
  'drop-or-flop': 'Drop or Flop',
  'who-sampled-it': 'Who Sampled It',
  'era': 'Era',
  'cover-or-not': 'Cover or Not',
}

export default function Dashboard() {
  const { user, profile, loading } = useAuth()
  const [scores, setScores] = useState([])
  const [streaks, setStreaks] = useState([])
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([
      getRecentScores(user.id),
      getStreaks(user.id),
    ])
      .then(([s, st]) => {
        setScores(s)
        setStreaks(st)
      })
      .finally(() => setDataLoading(false))
  }, [user])

  if (loading) return null
  if (!user) return <Navigate to="/login" state={{ from: '/dashboard' }} replace />

  const firstName = profile?.email?.split('@')[0] || 'there'
  const isSubscribed = profile?.is_subscribed

  return (
    <div className="page-shell-wide">
      <div className="dashboard-greeting">
        <h1 className="dashboard-title">Hey, {firstName}</h1>
        <span className={`dashboard-badge${isSubscribed ? ' dashboard-badge--subscribed' : ''}`}>
          {isSubscribed ? 'Subscribed' : 'Free'}
        </span>
      </div>

      <section className="dashboard-section">
        <p className="dashboard-section-label">current streaks</p>
        {dataLoading
          ? <div className="dashboard-streak-placeholder" />
          : <StreakDisplay streaks={streaks} />
        }
      </section>

      <section className="dashboard-section">
        <p className="dashboard-section-label">recent plays</p>
        {dataLoading ? (
          <p className="dashboard-empty">Loading...</p>
        ) : scores.length === 0 ? (
          <p className="dashboard-empty">
            No plays yet. <Link to="/">Play today's games</Link>
          </p>
        ) : (
          <div>
            {scores.map((score) => (
              <div key={score.id} className="dashboard-score-row">
                <div className="dashboard-score-left">
                  <span className={`dashboard-score-dot${score.completed ? ' dashboard-score-dot--complete' : ''}`} />
                  <div>
                    <div className="dashboard-score-name">
                      {GAME_NAMES[score.game_slug] || score.game_slug}
                    </div>
                    <div className="dashboard-score-date">{score.date_played}</div>
                  </div>
                </div>
                <div className="dashboard-score-attempts">
                  {score.attempts} {score.attempts === 1 ? 'attempt' : 'attempts'}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {isSubscribed ? (
        <p>
          <a
            href={import.meta.env.VITE_STRIPE_CUSTOMER_PORTAL_URL}
            className="dashboard-billing-link"
          >
            Manage billing
          </a>
        </p>
      ) : (
        <div className="dashboard-upsell">
          <p className="dashboard-upsell-title">Unlock the archive</p>
          <p className="dashboard-upsell-body">
            Play every past day and keep your streaks alive across all games.
          </p>
          <Link to="/subscribe" className="dashboard-upsell-btn btn-press">
            See plans
          </Link>
        </div>
      )}
    </div>
  )
}
