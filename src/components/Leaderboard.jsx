import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getLeaderboard } from '../lib/scores'
import { todayEST } from '../lib/date'
import DelayedSpinner from './DelayedSpinner'
import './Leaderboard.css'

function fmtTime(s) {
  if (s == null) return '—'
  const mins = Math.floor(s / 60)
  const secs = Math.floor(s % 60)
  const tenths = Math.floor((s % 1) * 10)
  return mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}.${tenths}s`
}

export default function Leaderboard({ gameSlug, puzzleDate }) {
  const { user, profile } = useAuth()
  const isPremium = profile?.is_subscribed
  const date = puzzleDate || todayEST()

  const [tab, setTab] = useState('friends')
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    getLeaderboard(user.id, gameSlug, date, tab)
      .then(setEntries)
      .finally(() => setLoading(false))
  }, [user, gameSlug, date, tab])

  const isTimeBased = gameSlug !== 'one-bar'

  return (
    <div className="leaderboard">
      <div className="leaderboard__header">
        <p className="leaderboard__title">Leaderboard</p>
        {isPremium && (
          <div className="leaderboard__tabs">
            <button
              className={`leaderboard__tab${tab === 'friends' ? ' leaderboard__tab--active' : ''}`}
              onClick={() => setTab('friends')}
            >Friends</button>
            <button
              className={`leaderboard__tab${tab === 'global' ? ' leaderboard__tab--active' : ''}`}
              onClick={() => setTab('global')}
            >Global</button>
          </div>
        )}
      </div>

      {!user ? (
        <p className="leaderboard__empty">
          <Link to="/login">Log in</Link> to see how friends did.
        </p>
      ) : loading ? (
        <DelayedSpinner active={loading} inline label="Loading leaderboard..." />
      ) : entries.length === 0 ? (
        <p className="leaderboard__empty">
          {tab === 'friends'
            ? "None of the people you follow have played yet, or they've set their profile to private."
            : 'No public scores yet for this puzzle.'}
        </p>
      ) : (
        <ol className="leaderboard__list">
          {entries.map((entry, i) => {
            const isMe = entry.userId === user?.id
            return (
              <li key={entry.userId} className={`leaderboard__row${isMe ? ' leaderboard__row--me' : ''}`}>
                <span className="leaderboard__rank">{i + 1}</span>
                <Link to={`/u/${entry.username}`} className="leaderboard__name">
                  {entry.username}
                  {isMe && <span className="leaderboard__you"> (you)</span>}
                </Link>
                <span className="leaderboard__score">
                  {isTimeBased ? fmtTime(entry.timeSeconds) : `${entry.attempts} guess${entry.attempts !== 1 ? 'es' : ''}`}
                </span>
              </li>
            )
          })}
        </ol>
      )}

      {!isPremium && user && (
        <p className="leaderboard__upsell">
          <Link to="/subscribe">Upgrade</Link> to see the global leaderboard.
        </p>
      )}
    </div>
  )
}
