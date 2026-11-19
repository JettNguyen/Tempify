import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getLeaderboard } from '../lib/scores'
import { hapticSelection } from '../lib/haptics'
import { todayEST, fmtTime } from '../lib/date'
import { fmtPoints, playPoints, withOwnPlay } from '../lib/points'
import { isTimedGame } from '../lib/games'
import DelayedSpinner from './DelayedSpinner'
import Icon from './Icon'
import './Leaderboard.css'

/**
 * The day's board for one game. `mine` is the play just shown in the result
 * ({ attempts, completed, timeSeconds, points }), which goes on the board if
 * the server doesn't have it yet.
 */
export default function Leaderboard({ gameSlug, puzzleDate, mine }) {
  const { user, profile } = useAuth()
  const isPremium = profile?.is_subscribed
  const date = puzzleDate || todayEST()

  const [tab, setTab] = useState('friends')
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    getLeaderboard(user.id, gameSlug, date, tab)
      .then((rows) => { if (!cancelled) setEntries(rows) })
      .catch(() => { if (!cancelled) setEntries([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    // Switching tabs mid-fetch must not let the slower response win.
    return () => { cancelled = true }
  }, [user, gameSlug, date, tab])

  // Ties in a game played against the clock go to the faster play, so the
  // time shows beside the points.
  const timed = isTimedGame(gameSlug)
  const own = user && mine ? {
    userId: user.id,
    username: profile?.username || 'anonymous',
    attempts: mine.attempts,
    timeSeconds: mine.timeSeconds ?? null,
    points: playPoints(gameSlug, { attempts: mine.attempts, completed: mine.completed, points: mine.points }),
  } : null
  const rows = loading ? entries : withOwnPlay(entries, own, { timed })

  return (
    <div className="leaderboard">
      <div className="leaderboard__header">
        <p className="leaderboard__title">Leaderboard</p>
        {isPremium && (
          <div className="leaderboard__tabs">
            <button
              className={`leaderboard__tab btn-press tap-target${tab === 'friends' ? ' leaderboard__tab--active' : ''}`}
              onClick={() => { hapticSelection(); setTab('friends') }}
            >Friends</button>
            <button
              className={`leaderboard__tab btn-press tap-target${tab === 'global' ? ' leaderboard__tab--active' : ''}`}
              onClick={() => { hapticSelection(); setTab('global') }}
            >Global</button>
          </div>
        )}
      </div>

      {!user ? (
        <p className="leaderboard__empty">
          <Icon name="users" size={20} className="leaderboard__empty-icon" />
          <Link to="/login">Log in</Link> to see how friends did.
        </p>
      ) : loading ? (
        <DelayedSpinner active={loading} inline label="Loading leaderboard..." />
      ) : rows.length === 0 ? (
        <p className="leaderboard__empty">
          <Icon name="users" size={20} className="leaderboard__empty-icon" />
          {tab === 'friends'
            ? "None of the people you follow have played yet, or they've set their profile to private."
            : 'No public scores yet for this puzzle.'}
        </p>
      ) : (
        <ol className="leaderboard__list">
          {rows.map((entry) => {
            const isMe = entry.userId === user?.id
            return (
              <li key={entry.userId} className={`leaderboard__row${isMe ? ' leaderboard__row--me' : ''}`}>
                <span className="leaderboard__rank">{entry.place}</span>
                <Link to={`/u/${entry.username}`} className="leaderboard__name">
                  {entry.username}
                  {isMe && <span className="leaderboard__you"> (you)</span>}
                </Link>
                <span className="leaderboard__score">
                  {fmtPoints(entry.points)} pts
                  {timed && entry.timeSeconds != null && (
                    <span className="leaderboard__time"> · {fmtTime(entry.timeSeconds)}</span>
                  )}
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
