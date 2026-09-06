import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { todayEST } from '../lib/date'
import { prefetchPuzzlesForDate } from '../lib/puzzles'
import { GAMES } from '../lib/games'
import GameGrid from '../components/GameGrid'
import DailyCompleteCta from '../components/DailyCompleteCta'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'
import './Home.css'

const dateLabel = () =>
  new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' })

export default function Home() {
  const { user, profile } = useAuth()
  const { isComplete, refresh: refreshCompletions } = useCompletion(user?.id)
  const [genres, setGenres] = useState({})
  const [scheduledSlugs, setScheduledSlugs] = useState([])

  // Doubles as a warm-up: the puzzles land in the shared cache, so tapping a
  // tile opens the game with no fetch and no spinner.
  const fetchGenres = useCallback(async () => {
    const puzzles = await prefetchPuzzlesForDate(todayEST())
    const map = {}
    puzzles.forEach((p) => { if (p.genre) map[p.game_slug] = p.genre })
    setGenres(map)
    setScheduledSlugs(GAMES.map(g => g.slug).filter(slug => puzzles.some(p => p.game_slug === slug)))
  }, [])

  useEffect(() => { fetchGenres() }, [fetchGenres])

  const onRefresh = useCallback(async () => {
    await fetchGenres()
    refreshCompletions?.()
  }, [fetchGenres, refreshCompletions])

  const { pullDistance, isRefreshing, isDragging } = usePullToRefresh(onRefresh)

  const tiles = GAMES.map((game) => ({
    ...game,
    complete: isComplete(game.slug, todayEST()),
    genre: genres[game.slug],
  }))

  // Measured against what was actually scheduled, so a missing puzzle doesn't
  // leave someone who played everything available with nothing to move on to.
  const allComplete = scheduledSlugs.length > 0 &&
    scheduledSlugs.every(slug => isComplete(slug, todayEST()))

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

      <GameGrid games={tiles} />

      {allComplete && (
        <DailyCompleteCta user={user} isSubscribed={profile?.is_subscribed} />
      )}

      {!user && !allComplete && (
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
