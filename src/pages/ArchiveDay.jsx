import { useState, useEffect } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getPuzzlesForDate } from '../lib/puzzles'
import ArchiveLock from '../components/ArchiveLock'

const GAME_NAMES = {
  'one-bar': 'One Bar',
  'drop-or-flop': 'Drop or Flop',
  'who-sampled-it': 'Who Sampled It',
  'era': 'Era',
  'the-flip': 'The Flip',
}

const GAME_PATHS = {
  'one-bar': '/game/one-bar',
  'drop-or-flop': '/game/drop-or-flop',
  'who-sampled-it': '/game/who-sampled-it',
  'era': '/game/era',
  'the-flip': '/game/the-flip',
}

export default function ArchiveDay() {
  const { date } = useParams()
  const { user, profile, loading } = useAuth()
  const [puzzles, setPuzzles] = useState([])
  const [fetching, setFetching] = useState(true)

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const isToday = date === today

  useEffect(() => {
    if (!user) return
    getPuzzlesForDate(date)
      .then(setPuzzles)
      .finally(() => setFetching(false))
  }, [date, user])

  if (loading) return null
  if (!user) return <Navigate to="/login" state={{ from: `/archive/${date}` }} replace />

  const isSubscribed = profile?.is_subscribed
  const isPast = date < today

  const formatted = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div style={{
      maxWidth: '680px',
      margin: '0 auto',
      padding: '88px 1.25rem 4rem',
    }}>
      <Link
        to="/archive"
        style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'inline-block', marginBottom: '1.5rem' }}
      >
        ← Archive
      </Link>

      <div style={{ marginBottom: '2rem' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>archive</p>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          {formatted}
        </h1>
      </div>

      {/* Lock for past dates if not subscribed */}
      {isPast && !isSubscribed ? (
        <ArchiveLock />
      ) : fetching ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading...</p>
      ) : puzzles.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No puzzles found for this date.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {puzzles.map((puzzle) => (
            <Link
              key={puzzle.id}
              to={GAME_PATHS[puzzle.game_slug] || '/'}
              style={{
                display: 'block',
                padding: '1.25rem 1.5rem',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                textDecoration: 'none',
                transition: 'background 80ms ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#1e1e1e'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--surface)'}
            >
              <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                {GAME_NAMES[puzzle.game_slug] || puzzle.game_slug}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {puzzle.answer}
                {puzzle.metadata?.artist && ` — ${puzzle.metadata.artist}`}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
