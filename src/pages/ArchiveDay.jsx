import { useState, useEffect } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { todayEST } from '../lib/date'
import { GAME_BY_SLUG, ALL_GAME_SLUGS } from '../lib/games'
import { prefetchPuzzlesForDate } from '../lib/puzzles'
import ArchiveLock from '../components/ArchiveLock'
import DelayedSpinner from '../components/DelayedSpinner'
import Icon from '../components/Icon'
import GameGrid from '../components/GameGrid'
import './ArchiveDay.css'
import './Home.css'

export default function ArchiveDay() {
  const { date } = useParams()
  const { user, profile, loading } = useAuth()
  const [puzzles, setPuzzles] = useState([])
  const [completedSlugs, setCompletedSlugs] = useState(new Set())
  const [fetching, setFetching] = useState(true)

  const today = todayEST()
  const isToday = date === today
  const isPast = date < today

  useEffect(() => {
    if (!user) return
    prefetchPuzzlesForDate(date)
      .then(setPuzzles)
      .finally(() => setFetching(false))
  }, [date, user])

  useEffect(() => {
    if (!user) return
    supabase.from('scores')
      .select('game_slug')
      .eq('user_id', user.id)
      .eq('date_played', date)
      .then(({ data }) => {
        if (data) setCompletedSlugs(new Set(data.map(s => s.game_slug)))
      })
  }, [user, date])

  if (loading) return null
  if (!user) return <Navigate to="/login" state={{ from: `/archive/${date}` }} replace />

  const isSubscribed = profile?.is_subscribed

  const formatted = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const puzzleMap = {}
  puzzles.forEach(p => { puzzleMap[p.game_slug] = p })

  // Retired games still appear on the dates they ran, so history stays playable.
  const tiles = ALL_GAME_SLUGS
    .filter(slug => puzzleMap[slug])
    .map(slug => ({
      // slug drives the per-game colour and symbol — it was missing here, so
      // archive tiles rendered with no theme colour at all.
      slug,
      name: GAME_BY_SLUG[slug].name,
      description: GAME_BY_SLUG[slug].description,
      path: `${GAME_BY_SLUG[slug].path}?date=${date}`,
      complete: completedSlugs.has(slug),
      genre: puzzleMap[slug]?.genre,
    }))

  return (
    <div className="page-shell-wide">
      <Link to="/explore" className="archive-day-back">← Explore</Link>

      <div className="archive-day-header">
        <p className="archive-day-eyebrow">{isToday ? 'today' : 'archive'}</p>
        <h1 className="archive-day-title">{formatted}</h1>
      </div>

      {isPast && !isSubscribed ? (
        <ArchiveLock />
      ) : fetching ? (
        <DelayedSpinner active={fetching} label="Loading archive day..." />
      ) : tiles.length === 0 ? (
        <p className="archive-day-empty">
          <Icon name="disc" size={22} className="archive-day-empty-icon" />
          No puzzles found for this date.
        </p>
      ) : (
        <GameGrid games={tiles} />
      )}
    </div>
  )
}
