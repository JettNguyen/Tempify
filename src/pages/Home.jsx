import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { todayEST } from '../lib/date'
import { prefetchPuzzlesForDate } from '../lib/puzzles'
import { GAMES } from '../lib/games'
import GameTile from '../components/GameTile'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'
import './Home.css'

const dateLabel = () =>
  new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' })

export default function Home() {
  const { user } = useAuth()
  const { isComplete, refresh: refreshCompletions } = useCompletion(user?.id)
  const [genres, setGenres] = useState({})

  // Doubles as a warm-up: the puzzles land in the shared cache, so tapping a
  // tile opens the game with no fetch and no spinner.
  const fetchGenres = useCallback(async () => {
    const puzzles = await prefetchPuzzlesForDate(todayEST())
    const map = {}
    puzzles.forEach((p) => { if (p.genre) map[p.game_slug] = p.genre })
    setGenres(map)
  }, [])

  useEffect(() => { fetchGenres() }, [fetchGenres])

  const onRefresh = useCallback(async () => {
    await fetchGenres()
    refreshCompletions?.()
  }, [fetchGenres, refreshCompletions])

  const { pullDistance, isRefreshing, isDragging } = usePullToRefresh(onRefresh)

  const [featured, ...rest] = GAMES
  const middle = rest.slice(0, 2)
  const bottom = rest.slice(2)

  return (
    <div
      className="page-shell-wide"
      style={{
        transform: `translateY(${pullDistance}px)`,
        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      }}
    >
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      <div className="home-header">
        <p className="home-date">{dateLabel()}</p>
        <h1 className="home-title">Today's games</h1>
      </div>

      <div style={{ marginBottom: '0.75rem' }}>
        <GameTile
          slug={featured.slug}
          name={featured.name}
          description={featured.description}
          path={featured.path}
          complete={isComplete(featured.slug, todayEST())}
          genre={genres[featured.slug]}
          featured
        />
      </div>

      <div className="home-grid-mid">
        {middle.map((game) => (
          <GameTile
            key={game.slug}
            slug={game.slug}
            name={game.name}
            description={game.description}
            path={game.path}
            complete={isComplete(game.slug, todayEST())}
            genre={genres[game.slug]}
          />
        ))}
      </div>

      <div className="home-grid-bot">
        {bottom.map((game) => (
          <GameTile
            key={game.slug}
            slug={game.slug}
            name={game.name}
            description={game.description}
            path={game.path}
            complete={isComplete(game.slug, todayEST())}
            genre={genres[game.slug]}
          />
        ))}
      </div>

      {!user && (
        <p className="home-no-account">
          <Link to="/login">Log in</Link> to track streaks and access the archive.
        </p>
      )}

      <p className="home-legal-links" aria-label="Legal links">
        <Link to="/privacy">Privacy Policy</Link>
        <span aria-hidden="true">•</span>
        <Link to="/terms">Terms of Service</Link>
      </p>
    </div>
  )
}
