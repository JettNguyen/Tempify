import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { GENRES, GENRE_COLORS } from '../lib/genres'
import ArchiveLock from '../components/ArchiveLock'

const GAME_LABELS = {
  'one-bar':        'One Bar',
  'drop-or-flop':   'Drop or Flop',
  'who-sampled-it': 'Who Sampled It',
  'era':            'Era',
  'the-flip':       'The Flip',
}

const PAGE_SIZE = 20

function GenrePill({ genre, active, onClick }) {
  const colors = GENRE_COLORS[genre]
  return (
    <button
      onClick={onClick}
      className="btn-press"
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
        transition: 'all 80ms ease',
      }}
    >
      {genre}
    </button>
  )
}

function PuzzleCard({ puzzle, played }) {
  const artist = puzzle.metadata?.artist
    ?? puzzle.metadata?.version_a?.artist
    ?? puzzle.metadata?.source_artist
    ?? null
  const genreColors = puzzle.genre ? GENRE_COLORS[puzzle.genre] : null
  const dateStr = new Date(puzzle.scheduled_date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <Link
      to={`/archive/${puzzle.scheduled_date}`}
      style={{
        display: 'block',
        padding: '1rem 1.25rem',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        textDecoration: 'none',
        transition: 'background 80ms ease',
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
      onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '10px', fontWeight: 500, padding: '2px 7px',
              borderRadius: '999px', background: 'var(--bg)',
              border: '1px solid var(--border)', color: 'var(--text-dim)',
              whiteSpace: 'nowrap',
            }}>
              {GAME_LABELS[puzzle.game_slug]}
            </span>
            {genreColors && (
              <span style={{
                fontSize: '10px', fontWeight: 500, padding: '2px 7px',
                borderRadius: '999px',
                background: genreColors.bg, color: genreColors.text,
                whiteSpace: 'nowrap',
              }}>
                {puzzle.genre}
              </span>
            )}
            {played && (
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', display: 'inline-block', flexShrink: 0 }} title="Played" />
            )}
          </div>
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: artist ? '2px' : 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {puzzle.answer}
          </p>
          {artist && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{artist}</p>
          )}
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-dim)', flexShrink: 0, paddingTop: '2px' }}>
          {dateStr}
        </span>
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
  const today = new Date().toISOString().split('T')[0]

  // Derive top genres from user's play history
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

      // Build set of "date|slug" keys
      const keys = scores.map(s => `${s.date_played}|${s.game_slug}`)
      setPlayedSlugs(new Set(keys))

      // Fetch the puzzles the user completed to get their genres
      const dates = [...new Set(scores.map(s => s.date_played))]
      const { data: played } = await supabase
        .from('puzzles')
        .select('game_slug, scheduled_date, genre')
        .in('scheduled_date', dates)
        .not('genre', 'is', null)

      if (!played?.length) return

      // Count genre frequency
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
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE)  // fetch one extra to detect more

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
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '88px 1.25rem 4rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>explore</p>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Browse by genre
        </h1>
      </div>

      {/* Genre filter pills */}
      <div style={{
        display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px',
        marginBottom: '2rem', scrollbarWidth: 'none',
      }}>
        <GenrePill genre="All" active={activeGenre === 'all'} onClick={() => setActiveGenre('all')} />
        {GENRES.map(g => (
          <GenrePill key={g} genre={g} active={activeGenre === g} onClick={() => setActiveGenre(g)} />
        ))}
      </div>

      {/* Recommendations — only shown on "All" tab when user has history */}
      {activeGenre === 'all' && topGenres.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            based on what you play
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {topGenres.map(([genre, count]) => {
              const colors = GENRE_COLORS[genre]
              return (
                <button
                  key={genre}
                  onClick={() => setActiveGenre(genre)}
                  className="btn-press"
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: colors?.text ?? 'var(--border)',
                    background: colors?.bg ?? 'var(--surface)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 500, color: colors?.text ?? 'var(--text-primary)', marginBottom: '1px' }}>
                    {genre}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {count} {count === 1 ? 'game' : 'games'} played
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Content — locked for free users */}
      {!isSubscribed ? (
        <ArchiveLock />
      ) : fetching && puzzles.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading...</p>
      ) : puzzles.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          No {activeGenre !== 'all' ? activeGenre + ' ' : ''}games in the archive yet.
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {puzzles.map(p => (
              <PuzzleCard
                key={p.id}
                puzzle={p}
                played={playedSlugs.has(`${p.scheduled_date}|${p.game_slug}`)}
              />
            ))}
          </div>

          {hasMore && (
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button
                onClick={() => setPage(n => n + 1)}
                disabled={fetching}
                className="btn-press"
                style={{
                  padding: '9px 22px', borderRadius: '999px',
                  border: '1px solid var(--border)', background: 'transparent',
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
