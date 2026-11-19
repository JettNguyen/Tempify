import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { todayEST, fmtDayNumber } from '../lib/date'
import { prefetchPuzzlesForDate } from '../lib/puzzles'
import { prefetchClip } from '../lib/audioEngine'
import { GAMES, GAME_SLUGS } from '../lib/games'
import { dayTally, playPoints } from '../lib/points'
import GameGrid from '../components/GameGrid'
import DayScore from '../components/DayScore'
import DailyCompleteCta from '../components/DailyCompleteCta'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'
import Icon from '../components/Icon'
import './Home.css'

const dateLabel = () =>
  new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' })

export default function Home() {
  const { user, profile } = useAuth()
  const { isComplete, completions, refresh: refreshCompletions } = useCompletion(user?.id)
  const [genres, setGenres] = useState({})
  const [puzzlesBySlug, setPuzzlesBySlug] = useState({})
  const [scheduledSlugs, setScheduledSlugs] = useState([])

  // Doubles as a warm-up: the puzzles land in the shared cache, so tapping a
  // tile opens the game with no fetch and no spinner. The clips start coming
  // down too: a game plays its clip from memory, so it needs the whole thing
  // before the first note, and this is the moment to get it.
  const fetchGenres = useCallback(async () => {
    const puzzles = await prefetchPuzzlesForDate(todayEST())
    const map = {}
    const bySlug = {}
    puzzles.forEach((p) => {
      if (p.genre) map[p.game_slug] = p.genre
      bySlug[p.game_slug] = p
      if (GAME_SLUGS.includes(p.game_slug)) prefetchClip(p.audio_url)
    })
    setGenres(map)
    setPuzzlesBySlug(bySlug)
    setScheduledSlugs(GAMES.map(g => g.slug).filter(slug => puzzles.some(p => p.game_slug === slug)))
  }, [])

  useEffect(() => { fetchGenres() }, [fetchGenres])

  const onRefresh = useCallback(async () => {
    await fetchGenres()
    refreshCompletions?.()
  }, [fetchGenres, refreshCompletions])

  const { pullDistance, isRefreshing, isDragging } = usePullToRefresh(onRefresh)

  const today = todayEST()
  // Today's play of each game played so far.
  const plays = Object.fromEntries(
    GAMES.filter(game => isComplete(game.slug, today))
      .map(game => [game.slug, completions[`${game.slug}|${today}`] || {}]),
  )
  const tally = dayTally(GAME_SLUGS, plays, puzzlesBySlug, today)

  const tiles = GAMES.map((game) => ({
    ...game,
    complete: Boolean(plays[game.slug]),
    points: plays[game.slug] ? playPoints(game.slug, plays[game.slug]) : null,
    genre: genres[game.slug],
  }))

  // Measured against what was actually scheduled, so a missing puzzle doesn't
  // leave someone who played everything available with nothing to move on to.
  const allComplete = scheduledSlugs.length > 0 &&
    scheduledSlugs.every(slug => isComplete(slug, today))

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
        <div className="home-header__text">
          <p className="home-date">{dateLabel()}<span className="home-number">{fmtDayNumber(today)}</span></p>
          <h1 className="home-title">Today's games</h1>
        </div>
        <DayScore date={today} points={tally.points} max={tally.max} played={tally.played} done={allComplete} />
      </div>

      {allComplete && (
        <DailyCompleteCta user={user} isSubscribed={profile?.is_subscribed} />
      )}

      <GameGrid games={tiles} />

      {/* Under the day's games, where someone who liked them looks next. */}
      <Link to="/make" className="home-make card-hover btn-press">
        <Icon name="plus" size={16} strokeWidth={2.25} className="home-make__icon" />
        <span className="home-make__text">
          <span className="home-make__title">Make a game for friends</span>
          <span className="home-make__body">
            Pick the songs and send the link.{!profile?.is_subscribed && ' Comes with Tempify+.'}
          </span>
        </span>
        <Icon name="chevronRight" size={15} className="home-make__go" />
      </Link>

      {!user && !allComplete && (
        <p className="home-no-account">
          <Link to="/login">Log in</Link> to track streaks and access the archive.
        </p>
      )}

      <p className="home-legal-links" aria-label="Help and legal links">
        <Link to="/privacy">Privacy Policy</Link>
        <span aria-hidden="true">•</span>
        <Link to="/terms">Terms of Service</Link>
        <span aria-hidden="true">•</span>
        <Link to="/support">Support</Link>
      </p>
    </div>
  )
}
