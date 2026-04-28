import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getRecentScores, getStreaks } from '../lib/scores'
import StreakDisplay from '../components/StreakDisplay'

const GAME_NAMES = {
  'one-bar': 'One Bar',
  'drop-or-flop': 'Drop or Flop',
  'who-sampled-it': 'Who Sampled It',
  'era': 'Era',
  'the-flip': 'The Flip',
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
    <div style={{
      maxWidth: '680px',
      margin: '0 auto',
      padding: '88px 1.25rem 4rem',
    }}>
      {/* Greeting */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Hey, {firstName}
        </h1>
        <span style={{
          fontSize: '12px',
          fontWeight: 500,
          padding: '4px 10px',
          borderRadius: '999px',
          background: isSubscribed ? 'var(--amber-glow)' : 'transparent',
          border: `1px solid ${isSubscribed ? 'var(--amber)' : 'var(--border)'}`,
          color: isSubscribed ? 'var(--amber)' : 'var(--text-dim)',
        }}>
          {isSubscribed ? 'Subscribed' : 'Free'}
        </span>
      </div>

      {/* Streaks */}
      <section style={{ marginBottom: '2.5rem' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          current streaks
        </p>
        {dataLoading ? (
          <div style={{ height: '80px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }} />
        ) : (
          <StreakDisplay streaks={streaks} />
        )}
      </section>

      {/* Recent completions */}
      <section style={{ marginBottom: '2.5rem' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          recent plays
        </p>
        {dataLoading ? (
          <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Loading...</p>
        ) : scores.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
            No plays yet. <Link to="/" style={{ color: 'var(--text-muted)' }}>Play today's games</Link>
          </p>
        ) : (
          <div>
            {scores.map((score, i) => (
              <div
                key={score.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: i < scores.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: score.completed ? 'var(--green)' : 'var(--text-dim)',
                    flexShrink: 0,
                    marginTop: '1px',
                  }} />
                  <div>
                    <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {GAME_NAMES[score.game_slug] || score.game_slug}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {score.date_played}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {score.attempts} {score.attempts === 1 ? 'attempt' : 'attempts'}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Subscription CTA or manage link */}
      {isSubscribed ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          <a
            href={import.meta.env.VITE_STRIPE_CUSTOMER_PORTAL_URL}
            style={{ color: 'var(--text-muted)', textDecoration: 'underline', textDecorationColor: 'var(--border)' }}
          >
            Manage billing
          </a>
        </p>
      ) : (
        <div style={{
          padding: '1.5rem',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
        }}>
          <p style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Unlock the archive
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Play every past day and keep your streaks alive across all games.
          </p>
          <Link
            to="/subscribe"
            className="btn-press"
            style={{
              display: 'inline-block',
              background: 'var(--amber)',
              color: '#0f0f0f',
              fontSize: '13px',
              fontWeight: 500,
              padding: '8px 18px',
              borderRadius: '999px',
            }}
          >
            See plans
          </Link>
        </div>
      )}
    </div>
  )
}
