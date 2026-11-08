import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getCustomScores } from '../lib/customGames'
import { fmtPoints } from '../lib/points'
import DelayedSpinner from './DelayedSpinner'
import Icon from './Icon'
import './Leaderboard.css'

function scoreText(row) {
  if (row.points != null) return `${fmtPoints(row.points)} pts`
  if (!row.guesses) return 'Missed'
  return `${row.guesses} guess${row.guesses === 1 ? '' : 'es'}`
}

/**
 * The board under a game a player made: everyone signed in who has played
 * it, best first. It takes the daily leaderboard's place, and the same
 * profile setting decides who shows on it.
 */
export default function CustomScoreboard({ custom }) {
  const { user } = useAuth()
  const location = useLocation()
  const [rows, setRows] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setFailed(false)
    getCustomScores(custom.code)
      .then((found) => { if (!cancelled) setRows(found) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
    // `posted` goes up when this player's score lands, so it shows at once.
  }, [custom.code, custom.posted, user?.id])

  let note = null
  if (custom.mine) note = "Your own plays don't go on the board, since you know the answers."
  else if (!user) {
    note = (
      <>
        <Link to="/login" state={{ from: `${location.pathname}${location.search}` }}>Log in</Link>
        {' '}to put your score on the board.
      </>
    )
  }

  return (
    <div className="leaderboard">
      <div className="leaderboard__header">
        <p className="leaderboard__title">Scoreboard</p>
      </div>

      {failed ? (
        <p className="leaderboard__empty">
          <Icon name="alert" size={20} className="leaderboard__empty-icon" />
          Couldn't load the scoreboard. Close this and open it again to try again.
        </p>
      ) : !rows ? (
        <DelayedSpinner active inline label="Loading scoreboard..." />
      ) : rows.length === 0 ? (
        <p className="leaderboard__empty">
          <Icon name="users" size={20} className="leaderboard__empty-icon" />
          {custom.mine ? 'Nobody has played it yet. Send the link to a friend.' : 'Nobody is on the board yet.'}
        </p>
      ) : (
        <ol className="leaderboard__list">
          {rows.map((row) => (
            <li key={row.username} className={`leaderboard__row${row.me ? ' leaderboard__row--me' : ''}`}>
              <span className="leaderboard__rank">{row.place}</span>
              <Link to={`/u/${row.username}`} className="leaderboard__name">
                {row.username}
                {row.me && <span className="leaderboard__you"> (you)</span>}
              </Link>
              <span className="leaderboard__score">{scoreText(row)}</span>
            </li>
          ))}
        </ol>
      )}

      {note && <p className="leaderboard__upsell">{note}</p>}
    </div>
  )
}
