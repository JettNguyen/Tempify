import { useState, useEffect } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { getPuzzlesForDate } from '../lib/puzzles'
import ArchiveLock from '../components/ArchiveLock'
import GameTile from '../components/GameTile'
import './ArchiveDay.css'
import './Home.css'

function gameMeta(date) {
  const q = `?date=${date}`
  return {
    'one-bar':        { name: 'One Bar',        description: 'Name the song from a tiny clip.',             path: `/game/one-bar${q}`,        featured: true },
    'drop-or-flop':   { name: 'Hit or Miss',    description: 'Did it ever chart on the Hot 100?',          path: `/game/drop-or-flop${q}` },
    'who-sampled-it': { name: 'Sampled',        description: 'Hear the sample, find the source.',          path: `/game/who-sampled-it${q}` },
    'era':            { name: 'Era',             description: 'Guess which decade the song is from.',       path: `/game/era${q}` },
    'cover-or-not':   { name: 'Cover or Not',   description: 'Is this song a cover of an earlier track?',  path: `/game/cover-or-not${q}` },
  }
}

const GAME_ORDER = ['one-bar', 'drop-or-flop', 'who-sampled-it', 'era', 'cover-or-not']

export default function ArchiveDay() {
  const { date } = useParams()
  const { user, profile, loading } = useAuth()
  const [puzzles, setPuzzles] = useState([])
  const [completedSlugs, setCompletedSlugs] = useState(new Set())
  const [fetching, setFetching] = useState(true)

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const isToday = date === today
  const isPast = date < today

  useEffect(() => {
    if (!user) return
    getPuzzlesForDate(date)
      .then(setPuzzles)
      .finally(() => setFetching(false))
  }, [date, user])

  useEffect(() => {
    if (!user) return
    supabase.from('scores')
      .select('game_slug')
      .eq('user_id', user.id)
      .eq('date_played', date)
      .eq('completed', true)
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

  // Build a slug→puzzle map, normalize the-flip → cover-or-not
  const puzzleMap = {}
  puzzles.forEach(p => {
    const slug = p.game_slug === 'the-flip' ? 'cover-or-not' : p.game_slug
    puzzleMap[slug] = p
  })

  const GAME_META = gameMeta(date)

  // Only show games that have a puzzle for this date
  const available = GAME_ORDER.filter(slug => puzzleMap[slug])
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
        <p className="archive-day-empty">Loading...</p>
      ) : available.length === 0 ? (
        <p className="archive-day-empty">No puzzles found for this date.</p>
      ) : (
        <>
          {featuredSlug && (
            <div style={{ marginBottom: '0.75rem' }}>
              <GameTile
                name={GAME_META[featuredSlug].name}
                description={GAME_META[featuredSlug].description}
                path={GAME_META[featuredSlug].path}
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
                  name={GAME_META[slug].name}
                  description={GAME_META[slug].description}
                  path={GAME_META[slug].path}
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
                  name={GAME_META[slug].name}
                  description={GAME_META[slug].description}
                  path={GAME_META[slug].path}
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
