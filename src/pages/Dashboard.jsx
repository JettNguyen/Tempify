import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getRecentScores, getStreaks } from '../lib/scores'
import { supabase } from '../lib/supabase'
import { todayEST } from '../lib/date'
import { openExternalUrlInApp } from '../lib/inAppBrowser'
import StreakDisplay from '../components/StreakDisplay'
import './Dashboard.css'

const GAME_NAMES = {
  'one-bar': 'One Bar',
  'hit-or-miss': 'Hit or Miss',
  'sampled': 'Sampled',
  'era': 'Era',
  'cover-or-not': 'Cover or Not',
}

const FREEZE_TOKENS_PER_MONTH = 2

function pct(value) { return `${Math.round(value * 100)}%` }

function buildStats(scores) {
  const completed = scores.filter(s => s.completed)
  const totalAttempts = scores.reduce((sum, s) => sum + (s.attempts || 0), 0)
  const byGame = Object.keys(GAME_NAMES).map(slug => {
    const plays = scores.filter(s => s.game_slug === slug)
    const wins = plays.filter(s => s.completed)
    const attempts = plays.reduce((sum, s) => sum + (s.attempts || 0), 0)
    const times = plays.filter(s => s.time_seconds != null).map(s => s.time_seconds)
    return {
      slug, name: GAME_NAMES[slug],
      plays: plays.length, wins: wins.length,
      winRate: plays.length ? wins.length / plays.length : 0,
      avgAttempts: plays.length ? attempts / plays.length : 0,
      avgTime: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
    }
  })

  const activeGames = byGame.filter(g => g.plays > 0)
  const bestGame = [...activeGames].sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)[0]
  const oneTryWins = scores.filter(s => s.completed && s.attempts === 1).length
  const uniqueDays = new Set(scores.map(s => s.date_played)).size

  return {
    plays: scores.length, wins: completed.length,
    winRate: scores.length ? completed.length / scores.length : 0,
    avgAttempts: scores.length ? totalAttempts / scores.length : 0,
    oneTryWins, uniqueDays, bestGame, byGame,
  }
}

function fmtTime(s) {
  if (s == null) return '—'
  const mins = Math.floor(s / 60)
  const secs = Math.floor(s % 60)
  return mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`
}

export default function Dashboard() {
  const { user, profile, loading } = useAuth()
  const [scores, setScores] = useState([])
  const [streaks, setStreaks] = useState([])
  const [freezesUsed, setFreezesUsed] = useState(0)
  const [dataLoading, setDataLoading] = useState(true)

  const isSubscribed = profile?.is_subscribed
  const customerPortalUrl = import.meta.env.VITE_STRIPE_CUSTOMER_PORTAL_URL

  async function handleManageBillingClick(event) {
    event.preventDefault()
    await openExternalUrlInApp(customerPortalUrl)
  }

  useEffect(() => {
    if (!user) return
    const month = todayEST().slice(0, 7)
    Promise.all([
      getRecentScores(user.id, 500),
      getStreaks(user.id),
      isSubscribed
        ? supabase.from('streak_freezes').select('tokens_used').eq('user_id', user.id).eq('month', month)
          .then(({ data }) => (data || []).reduce((sum, r) => sum + r.tokens_used, 0))
        : Promise.resolve(0),
    ])
      .then(([s, st, freezes]) => {
        setScores(s)
        setStreaks(st)
        setFreezesUsed(freezes)
      })
      .finally(() => setDataLoading(false))
  }, [user, isSubscribed])

  if (loading) return null
  if (!user) return <Navigate to="/login" state={{ from: '/dashboard' }} replace />

  const displayName = profile?.username ? `@${profile.username}` : (profile?.email?.split('@')[0] || 'there')
  const stats = buildStats(scores)
  const freezesLeft = FREEZE_TOKENS_PER_MONTH - freezesUsed

  return (
    <div className="page-shell-wide">
      <div className="dashboard-greeting">
        <h1 className="dashboard-title">Hey, {displayName}</h1>
        <span className={`dashboard-badge${isSubscribed ? ' dashboard-badge--subscribed' : ''}`}>
          {isSubscribed ? 'Premium' : 'Free'}
        </span>
      </div>

      {/* Public profile link */}
      {profile?.username && (
        <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '1.25rem' }}>
          <Link to={`/u/${profile.username}`} style={{ color: 'var(--amber)' }}>View public profile →</Link>
        </p>
      )}

      {/* Streaks + freeze status */}
      <section className="dashboard-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <p className="dashboard-section-label" style={{ marginBottom: 0 }}>current streaks</p>
          {isSubscribed && (
            <span style={{ fontSize: '11px', color: freezesLeft > 0 ? 'var(--amber)' : 'var(--text-dim)' }}>
              🧊 {freezesLeft} freeze{freezesLeft !== 1 ? 's' : ''} left this month
            </span>
          )}
        </div>
        {dataLoading ? <div className="dashboard-streak-placeholder" /> : <StreakDisplay streaks={streaks} />}
      </section>

      {/* Stats - gated for non-premium */}
      <section className="dashboard-section">
        <p className="dashboard-section-label">stats</p>
        {dataLoading ? (
          <div className="dashboard-stats-placeholder" />
        ) : scores.length === 0 ? (
          <p className="dashboard-empty">Stats will appear after your first play.</p>
        ) : !isSubscribed ? (
          // Free users: only totals
          <div>
            <div className="dashboard-stat-grid">
              <StatCard label="Games played" value={stats.plays} detail={`${stats.wins} wins`} />
              <StatCard label="Win rate" value={pct(stats.winRate)} detail="Overall" />
            </div>
            <div className="dashboard-upsell" style={{ marginTop: '1rem' }}>
              <p className="dashboard-upsell-title">Unlock detailed stats</p>
              <p className="dashboard-upsell-body">
                Get per-game breakdowns, average time, streaks, and leaderboard rankings with Premium.
              </p>
              <Link to="/subscribe" className="dashboard-upsell-btn btn-press">See plans</Link>
            </div>
          </div>
        ) : (
          // Premium users: full stats
          <>
            <div className="dashboard-stat-grid">
              <StatCard label="Win rate" value={pct(stats.winRate)} detail={`${stats.wins}/${stats.plays} games won`} />
              <StatCard label="Avg attempts" value={stats.avgAttempts.toFixed(1)} detail="One Bar only" />
              <StatCard label="One-try wins" value={stats.oneTryWins} detail="Solved on the first shot" />
              <StatCard label="Days played" value={stats.uniqueDays} detail={stats.bestGame ? `Best: ${stats.bestGame.name}` : 'Keep playing'} />
            </div>

            <div className="dashboard-game-stats">
              {stats.byGame.map(game => (
                <div key={game.slug} className={`dashboard-game-stat dashboard-game-stat--${game.slug}`}>
                  <div className="dashboard-game-stat__top">
                    <span>{game.name}</span>
                    <strong>{game.plays ? pct(game.winRate) : '--'}</strong>
                  </div>
                  <div className="dashboard-game-stat__bar">
                    <span style={{ width: `${game.winRate * 100}%` }} />
                  </div>
                  <div className="dashboard-game-stat__meta">
                    <span>{game.wins}/{game.plays} wins</span>
                    <span>
                      {game.slug === 'one-bar'
                        ? (game.plays ? `${game.avgAttempts.toFixed(1)} avg guesses` : 'No plays yet')
                        : (game.avgTime != null ? `avg ${fmtTime(game.avgTime)}` : 'No plays yet')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Recent plays */}
      <section className="dashboard-section">
        <p className="dashboard-section-label">recent plays</p>
        {dataLoading ? (
          <p className="dashboard-empty">Loading...</p>
        ) : scores.length === 0 ? (
          <p className="dashboard-empty">No plays yet. <Link to="/">Play today's games</Link></p>
        ) : (
          <div>
            {scores.slice(0, 20).map(score => (
              <div key={score.id} className="dashboard-score-row">
                <div className="dashboard-score-left">
                  <span className={`dashboard-score-dot${score.completed ? ' dashboard-score-dot--complete' : ''}`} />
                  <div>
                    <div className="dashboard-score-name">{GAME_NAMES[score.game_slug] || score.game_slug}</div>
                    <div className="dashboard-score-date">{score.date_played}</div>
                  </div>
                </div>
                <div className="dashboard-score-attempts">
                  {score.game_slug === 'one-bar'
                    ? `${score.attempts} guess${score.attempts !== 1 ? 'es' : ''}`
                    : score.time_seconds != null ? fmtTime(score.time_seconds) : (score.completed ? 'Win' : 'Loss')}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {isSubscribed ? (
        <p>
          <a href={customerPortalUrl} onClick={handleManageBillingClick} className="dashboard-billing-link">
            Manage billing
          </a>
        </p>
      ) : (
        <div className="dashboard-upsell">
          <p className="dashboard-upsell-title">Unlock the archive</p>
          <p className="dashboard-upsell-body">
            Play every past day and keep your streaks alive across all games.
          </p>
          <Link to="/subscribe" className="dashboard-upsell-btn btn-press">See plans</Link>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, detail }) {
  return (
    <div className="dashboard-stat-card">
      <p className="dashboard-stat-card__label">{label}</p>
      <p className="dashboard-stat-card__value">{value}</p>
      <p className="dashboard-stat-card__detail">{detail}</p>
    </div>
  )
}
