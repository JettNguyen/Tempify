import { useState, useEffect } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { todayEST } from '../lib/date'
import { GAME_BY_SLUG, ALL_GAME_SLUGS } from '../lib/games'
import { prefetchPuzzlesForDate } from '../lib/puzzles'
import ArchiveLock from '../components/ArchiveLock'
import DelayedSpinner from '../components/DelayedSpinner'
import GameTile from '../components/GameTile'
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
  const available = ALL_GAME_SLUGS.filter(slug => puzzleMap[slug])
  const [featuredSlug, ...rest] = available
  const middle = rest.slice(0, 2)
  const bottom = rest.slice(2)

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
      ) : available.length === 0 ? (
        <p className="archive-day-empty">No puzzles found for this date.</p>
      ) : (
        <>
          {featuredSlug && (
            <div style={{ marginBottom: '0.75rem' }}>
              <GameTile
                name={GAME_BY_SLUG[featuredSlug].name}
                description={GAME_BY_SLUG[featuredSlug].description}
                path={`${GAME_BY_SLUG[featuredSlug].path}?date=${date}`}
                complete={completedSlugs.has(featuredSlug)}
                genre={puzzleMap[featuredSlug]?.genre}
                featured
              />
            </div>
          )}

          {middle.length > 0 && (
            <div className="home-grid-mid">
              {middle.map(slug => (
                <GameTile
                  key={slug}
                  name={GAME_BY_SLUG[slug].name}
                  description={GAME_BY_SLUG[slug].description}
                  path={`${GAME_BY_SLUG[slug].path}?date=${date}`}
                  complete={completedSlugs.has(slug)}
                  genre={puzzleMap[slug]?.genre}
                />
              ))}
            </div>
          )}

          {bottom.length > 0 && (
            <div className="home-grid-bot">
              {bottom.map(slug => (
                <GameTile
                  key={slug}
                  name={GAME_BY_SLUG[slug].name}
                  description={GAME_BY_SLUG[slug].description}
                  path={`${GAME_BY_SLUG[slug].path}?date=${date}`}
                  complete={completedSlugs.has(slug)}
                  genre={puzzleMap[slug]?.genre}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
