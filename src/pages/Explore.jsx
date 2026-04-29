import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { todayEST } from '../lib/date'
import { GENRES, GENRE_COLORS } from '../lib/genres'
import ArchiveLock from '../components/ArchiveLock'
import './Explore.css'

const GAME_LABELS = {
  'one-bar':        'One Bar',
  'drop-or-flop':   'Drop or Flop',
  'who-sampled-it': 'Who Sampled It',
  'era':            'Era',
  'cover-or-not':   'Cover or Not',
}

const PAGE_SIZE = 20

function GenrePill({ genre, active, onClick }) {
  const colors = GENRE_COLORS[genre]
  return (
    <button
      onClick={onClick}
      className="btn-press btn-hover"
      style={{
        padding: '6px 13px',
        borderRadius: '999px',
        border: '1px solid',
        borderColor: active ? (colors?.text ?? 'var(--amber)') : 'var(--border)',
        background: active ? (colors?.bg ?? 'var(--amber-glow)') : 'transparent',
        color: active ? (colors?.text ?? 'var(--amber)') : 'var(--text-muted)',
        fontSize: '12px',
        fontWeight: active ? 500 : 400,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {genre}
    </button>
  )
}

function PuzzleCard({ puzzle, played }) {
  const artist = puzzle.metadata?.artist
    ?? puzzle.metadata?.song_artist
    ?? puzzle.metadata?.source_artist
    ?? null
  const genreColors = puzzle.genre ? GENRE_COLORS[puzzle.genre] : null
  const dateStr = new Date(puzzle.scheduled_date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <Link
      to={`/archive/${puzzle.scheduled_date}`}
      className="explore-puzzle-card card-hover card-lift btn-press"
    >
      <div className="explore-puzzle-inner">
        <div className="explore-puzzle-left">
          <div className="explore-puzzle-tags">
            <span className="explore-game-tag">{GAME_LABELS[puzzle.game_slug]}</span>
            {genreColors && (
              <span
                style={{ fontSize: '10px', fontWeight: 500, padding: '2px 7px', borderRadius: '999px', background: genreColors.bg, color: genreColors.text, whiteSpace: 'nowrap' }}
              >
                {puzzle.genre}
              </span>
            )}
            {played && <span className="explore-played-dot" title="Played" />}
          </div>
          <p className="explore-puzzle-answer">{puzzle.answer}</p>
          {artist && <p className="explore-puzzle-artist">{artist}</p>}
        </div>
        <span className="explore-puzzle-date">{dateStr}</span>
      </div>
    </Link>
  )
}

export default function Explore() {
  const { user, profile, loading } = useAuth()
  const [activeGenre, setActiveGenre] = useState('all')
  const [puzzles, setPuzzles] = useState([])
  const [playedSlugs, setPlayedSlugs] = useState(new Set())
  const [topGenres, setTopGenres] = useState([])
  const [fetching, setFetching] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  if (loading) return null
  if (!user) return <Navigate to="/login" state={{ from: '/explore' }} replace />

  const isSubscribed = profile?.is_subscribed
  const today = todayEST()

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!user) return
    async function loadHistory() {
      const { data: scores } = await supabase
        .from('scores')
        .select('game_slug, date_played')
        .eq('user_id', user.id)
        .eq('completed', true)

      if (!scores?.length) return

      const keys = scores.map(s => `${s.date_played}|${s.game_slug}`)
      setPlayedSlugs(new Set(keys))

      const dates = [...new Set(scores.map(s => s.date_played))]
      const { data: played } = await supabase
        .from('puzzles')
        .select('game_slug, scheduled_date, genre')
        .in('scheduled_date', dates)
        .not('genre', 'is', null)

      if (!played?.length) return

      const freq = {}
      played.forEach(p => {
        const key = `${p.scheduled_date}|${p.game_slug}`
        if (keys.includes(key) && p.genre) {
          freq[p.genre] = (freq[p.genre] || 0) + 1
        }
      })

      const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3)
      setTopGenres(sorted)
    }
    loadHistory()
  }, [user])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    setPage(1)
    setPuzzles([])
  }, [activeGenre])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    let cancelled = false
    async function load() {
      setFetching(true)
      let q = supabase
        .from('puzzles')
        .select('id, game_slug, scheduled_date, answer, genre, metadata')
        .lt('scheduled_date', today)
        .order('scheduled_date', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

      if (activeGenre !== 'all') q = q.eq('genre', activeGenre)

      const { data } = await q
      if (cancelled || !data) return

      const items = data.slice(0, PAGE_SIZE)
      setHasMore(data.length > PAGE_SIZE)
      setPuzzles(prev => page === 1 ? items : [...prev, ...items])
      setFetching(false)
    }
    load()
    return () => { cancelled = true }
  }, [activeGenre, page, today])

  return (
    <div className="page-shell-wide">
      <div className="explore-header">
        <p className="explore-eyebrow">explore</p>
        <h1 className="explore-title">Browse by genre</h1>
      </div>

      <div className="explore-pills">
        <GenrePill genre="All" active={activeGenre === 'all'} onClick={() => setActiveGenre('all')} />
        {GENRES.map(g => (
          <GenrePill key={g} genre={g} active={activeGenre === g} onClick={() => setActiveGenre(g)} />
        ))}
      </div>

      {activeGenre === 'all' && topGenres.length > 0 && (
        <div className="explore-recs">
          <p className="explore-recs-label">based on what you play</p>
          <div className="explore-recs-list">
            {topGenres.map(([genre, count]) => {
              const colors = GENRE_COLORS[genre]
              return (
                <button
                  key={genre}
                  onClick={() => setActiveGenre(genre)}
                  className="explore-rec-btn btn-press btn-hover"
                  style={{
                    borderColor: colors?.text ?? 'var(--border)',
                    background: colors?.bg ?? 'var(--surface)',
                  }}
                >
                  <div className="explore-rec-btn__name" style={{ color: colors?.text ?? 'var(--text-primary)' }}>
                    {genre}
                  </div>
                  <div className="explore-rec-btn__count">
                    {count} {count === 1 ? 'game' : 'games'} played
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {!isSubscribed ? (
        <ArchiveLock />
      ) : fetching && puzzles.length === 0 ? (
        <p className="explore-empty">Loading...</p>
      ) : puzzles.length === 0 ? (
        <p className="explore-empty">
          No {activeGenre !== 'all' ? activeGenre + ' ' : ''}games in the archive yet.
        </p>
      ) : (
        <>
          <div className="explore-puzzle-list">
            {puzzles.map(p => (
              <PuzzleCard
                key={p.id}
                puzzle={p}
                played={playedSlugs.has(`${p.scheduled_date}|${p.game_slug}`)}
              />
            ))}
          </div>

          {hasMore && (
            <div className="explore-load-more">
              <button
                onClick={() => setPage(n => n + 1)}
                disabled={fetching}
                className="btn-press btn-hover"
                style={{
                  padding: '9px 22px', borderRadius: '999px',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer',
                }}
              >
                {fetching ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
