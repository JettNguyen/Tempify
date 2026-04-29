import { useState, useEffect } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getPuzzlesForDate } from '../lib/puzzles'
import ArchiveLock from '../components/ArchiveLock'
import './ArchiveDay.css'

const GAME_NAMES = {
  'one-bar': 'One Bar',
  'drop-or-flop': 'Drop or Flop',
  'who-sampled-it': 'Who Sampled It',
  'era': 'Era',
  'cover-or-not': 'Cover or Not',
}

const GAME_PATHS = {
  'one-bar': '/game/one-bar',
  'drop-or-flop': '/game/drop-or-flop',
  'who-sampled-it': '/game/who-sampled-it',
  'era': '/game/era',
  'cover-or-not': '/game/cover-or-not',
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
    <div className="page-shell-wide">
      <Link to="/archive" className="archive-day-back">← Archive</Link>

      <div className="archive-day-header">
        <p className="archive-day-eyebrow">archive</p>
        <h1 className="archive-day-title">{formatted}</h1>
      </div>

      {isPast && !isSubscribed ? (
        <ArchiveLock />
      ) : fetching ? (
        <p className="archive-day-empty">Loading...</p>
      ) : puzzles.length === 0 ? (
        <p className="archive-day-empty">No puzzles found for this date.</p>
      ) : (
        <div className="archive-puzzle-list">
          {puzzles.map((puzzle) => (
            <Link
              key={puzzle.id}
              to={GAME_PATHS[puzzle.game_slug] || '/'}
              className="archive-puzzle-card card-hover card-lift btn-press"
            >
              <div className="archive-puzzle-name">
                {GAME_NAMES[puzzle.game_slug] || puzzle.game_slug}
              </div>
              <div className="archive-puzzle-answer">
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
