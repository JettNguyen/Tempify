import { useState, useEffect } from 'react'
import { getPuzzleStats } from '../lib/scores'
import { todayEST } from '../lib/date'
import './PuzzleStats.css'

// One Bar unlocks a fixed ladder of clip lengths, one rung per attempt, so an
// attempt count is really a statement about how much audio someone needed.
const ONE_BAR_BUCKETS = [
  { key: '1', label: '0.5s' },
  { key: '2', label: '1s' },
  { key: '3', label: '2s' },
  { key: '4', label: '5s' },
  { key: '5', label: '15s' },
  { key: '6', label: '30s' },
]

// Every other game is a single choice, so time is the only thing that varies.
// These edges have to match the ones in get_puzzle_stats.
const TIME_BUCKETS = [
  { key: '0', label: 'Under 5s' },
  { key: '1', label: '5 to 10s' },
  { key: '2', label: '10 to 20s' },
  { key: '3', label: '20 to 30s' },
  { key: '4', label: '30 to 60s' },
  { key: '5', label: 'Over 1m' },
]

function timeBucket(seconds) {
  if (seconds == null) return null
  if (seconds < 5) return '0'
  if (seconds < 10) return '1'
  if (seconds < 20) return '2'
  if (seconds < 30) return '3'
  if (seconds < 60) return '4'
  return '5'
}

export default function PuzzleStats({ gameSlug, puzzleDate, attempts, timeSeconds, correct }) {
  const date = puzzleDate || todayEST()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let cancelled = false
    getPuzzleStats(gameSlug, date)
      .then((s) => { if (!cancelled) setStats(s) })
      .catch(() => { if (!cancelled) setStats(null) })
    return () => { cancelled = true }
  }, [gameSlug, date])

  // No stats, no players yet, or the project has not run the migration: show
  // nothing rather than an empty chart claiming nobody solved it.
  if (!stats || !stats.total) return null

  const isOneBar = gameSlug === 'one-bar'
  const buckets = isOneBar ? ONE_BAR_BUCKETS : TIME_BUCKETS
  const counts = (isOneBar ? stats.attempts : stats.times) || {}

  // Only a win has a bar to sit in. A loss still gets the solve rate, which is
  // the part that says whether the puzzle was hard or you were.
  const mine = correct ? (isOneBar ? String(attempts) : timeBucket(timeSeconds)) : null

  const max = Math.max(1, ...buckets.map((b) => counts[b.key] || 0))
  const solveRate = Math.round((stats.solved / stats.total) * 100)
  const players = stats.total

  return (
    <div className={`puzzle-stats game-theme--${gameSlug}`}>
      <p className="puzzle-stats__title">How everyone did</p>
      <p className="puzzle-stats__rate">
        <strong>{solveRate}%</strong> of {players} {players === 1 ? 'player' : 'players'} solved this
      </p>
      <div className="puzzle-stats__rows">
        {buckets.map((b) => {
          const n = counts[b.key] || 0
          const isMine = b.key === mine
          return (
            <div key={b.key} className={`puzzle-stats__row${isMine ? ' puzzle-stats__row--mine' : ''}`}>
              <span className="puzzle-stats__label">{b.label}</span>
              <span className="puzzle-stats__track">
                <span
                  className="puzzle-stats__bar"
                  style={{ width: n ? `${Math.max(3, (n / max) * 100)}%` : 0 }}
                />
              </span>
              <span className="puzzle-stats__count">{n}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
