import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { todayEST } from '../lib/date'
import { GENRES, GENRE_COLORS } from '../lib/genres'
import ArchiveLock from '../components/ArchiveLock'
import './Explore.css'
import './Archive.css'

const GAMES = [
  { slug: 'one-bar',        name: 'One Bar',        path: '/game/one-bar' },
  { slug: 'hit-or-miss',    name: 'Hit or Miss',    path: '/game/hit-or-miss' },
  { slug: 'sampled',        name: 'Sampled',        path: '/game/sampled' },
  { slug: 'era',            name: 'Era',            path: '/game/era' },
  { slug: 'cover-or-not',   name: 'Cover or Not',   path: '/game/cover-or-not' },
]

const FIRST_PUZZLE_DATE = '2026-04-28'

function getDisplayAnswer(puzzle) {
  const slug = puzzle.game_slug
  if (slug === 'cover-or-not') {
    if (puzzle.answer === 'cover' || puzzle.answer === 'a') return puzzle.metadata?.song_title || 'Cover'
    if (puzzle.answer === 'original' || puzzle.answer === 'b') return puzzle.metadata?.song_title || 'Original'
    return puzzle.metadata?.song_title ?? puzzle.answer
  }
  if (slug === 'era') return puzzle.metadata?.title ?? puzzle.answer
  return puzzle.answer
}

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate() }
function getFirstDayOfMonth(year, month) { return new Date(year, month, 1).getDay() }
function pad(n) { return String(n).padStart(2, '0') }

export default function Explore() {
  const { user, profile, loading } = useAuth()
  const [view, setView] = useState('browse')
  const [activeGenres, setActiveGenres] = useState([])
  const [allPuzzles, setAllPuzzles] = useState([])
  const [playedSlugs, setPlayedSlugs] = useState(new Set())
  const [fetching, setFetching] = useState(true)

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const todayStr = todayEST()
  const todayCalStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

  useEffect(() => {
    if (!user) return
    supabase.from('scores').select('game_slug, date_played').eq('user_id', user.id)
      .then(({ data }) => {
        if (data?.length) setPlayedSlugs(new Set(data.map(s => `${s.date_played}|${s.game_slug}`)))
      })
  }, [user])

  useEffect(() => {
    setFetching(true)
    supabase.from('puzzles')
      .select('id, game_slug, scheduled_date, answer, genre, metadata')
      .lte('scheduled_date', todayStr)
      .order('scheduled_date', { ascending: false })
      .then(({ data }) => {
        setAllPuzzles(data || [])
        setFetching(false)
      })
  }, [todayStr])

  if (loading) return null

  const isSubscribed = Boolean(user && profile?.is_subscribed)

  function toggleGenre(g) {
    setActiveGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
  }

  const filtered = activeGenres.length === 0
    ? allPuzzles
    : allPuzzles.filter(p => p.genre && activeGenres.includes(p.genre))

  const byGame = {}
  GAMES.forEach(g => { byGame[g.slug] = [] })
  filtered.forEach(p => {
    if (byGame[p.game_slug]) byGame[p.game_slug].push(p)
  })

  // Calendar
  const firstPuzzle = new Date(FIRST_PUZZLE_DATE + 'T12:00:00')
  const isEarliestMonth = viewYear === firstPuzzle.getFullYear() && viewMonth === firstPuzzle.getMonth()
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth()
  const monthName = new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const days = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)

  function prevMonth() {
    if (isEarliestMonth) return
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (isCurrentMonth) return
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  return (
    <div className="page-shell-wide">
      <div className="explore-header">
        <p className="explore-eyebrow">explore</p>
        <div className="explore-title-row">
          <h1 className="explore-title">Browse puzzles</h1>
          <div className="explore-view-toggle">
            <button
              onClick={() => setView('browse')}
              className={`explore-view-btn btn-press${view === 'browse' ? ' explore-view-btn--active' : ''}`}
            >Browse</button>
            <button
              onClick={() => setView('calendar')}
              className={`explore-view-btn btn-press${view === 'calendar' ? ' explore-view-btn--active' : ''}`}
            >Calendar</button>
          </div>
        </div>
      </div>

      <div className="explore-pills">
        {GENRES.map(g => {
          const active = activeGenres.includes(g)
          const colors = GENRE_COLORS[g]
          return (
            <button
              key={g}
              onClick={() => toggleGenre(g)}
              className="btn-press btn-hover"
              style={{
                padding: '6px 13px', borderRadius: '999px', border: '1px solid',
                borderColor: active ? (colors?.text ?? 'var(--amber)') : 'var(--border)',
                background: active ? (colors?.bg ?? 'var(--amber-glow)') : 'transparent',
                color: active ? (colors?.text ?? 'var(--amber)') : 'var(--text-muted)',
                fontSize: '12px', fontWeight: active ? 500 : 400, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >{g}</button>
          )
        })}
        {activeGenres.length > 0 && (
          <button
            onClick={() => setActiveGenres([])}
            className="btn-press btn-hover"
            style={{ padding: '6px 13px', borderRadius: '999px', border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >Clear ✕</button>
        )}
      </div>

      {!isSubscribed ? (
        <ArchiveLock />
      ) : view === 'calendar' ? (
        <div>
          <div className="explore-cal-header">
            <h2 className="explore-cal-title">{monthName}</h2>
            <div className="archive-month-nav">
              <CalNavBtn onClick={prevMonth} label="←" disabled={isEarliestMonth} />
              <CalNavBtn onClick={nextMonth} label="→" disabled={isCurrentMonth} />
            </div>
          </div>
          <div className="archive-weekdays">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} className="archive-weekday">{d}</div>
            ))}
          </div>
          <div className="archive-grid">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: days }).map((_, i) => {
              const day = i + 1
              const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
              const isToday = dateStr === todayCalStr
              const isFuture = dateStr > todayCalStr
              const hasPuzzles = dateStr >= FIRST_PUZZLE_DATE && !isFuture

              if (isFuture) return (
                <div key={day} className="archive-day archive-day--future">
                  <span className="archive-day__num archive-day__num--future">{day}</span>
                </div>
              )
              if (isToday) return (
                <Link key={day} to={`/archive/${dateStr}`} className="archive-day archive-day--today day-hover btn-press">
                  <span className="archive-day__num archive-day__num--today">{day}</span>
                  {hasPuzzles && <span className="archive-day__dot" />}
                </Link>
              )
              return (
                <Link key={day} to={`/archive/${dateStr}`} className={`archive-day day-hover btn-press${!hasPuzzles ? ' archive-day--pre-launch' : ''}`}>
                  <span className="archive-day__num archive-day__num--past">{day}</span>
                  {hasPuzzles && <span className="archive-day__dot" />}
                </Link>
              )
            })}
          </div>
        </div>
      ) : fetching ? (
        <p className="explore-empty">Loading...</p>
      ) : (
        <div className="explore-games">
          {GAMES.map(game => {
            const puzzles = byGame[game.slug]
            if (!puzzles?.length) return null
            return (
              <div key={game.slug} className="explore-game-row">
                <h2 className="explore-game-row__title">{game.name}</h2>
                <div className="explore-game-row__scroll">
                  {puzzles.map(p => {
                    const played = playedSlugs.has(`${p.scheduled_date}|${p.game_slug}`)
                    const gameLink = `${game.path}?date=${p.scheduled_date}`
                    const dateStr = new Date(p.scheduled_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    const answer = getDisplayAnswer(p)
                    const artistLine = p.metadata?.song_artist || p.metadata?.artist || null
                    const genreColors = p.genre ? GENRE_COLORS[p.genre] : null
                    return (
                      <Link key={p.id} to={gameLink} className={`explore-game-card card-hover btn-press${played ? ' explore-game-card--played' : ''}`}>
                        <div className="explore-game-card__date">{dateStr}</div>
                        {played ? (
                          <>
                            <div className="explore-game-card__answer">{answer}</div>
                            {artistLine && <div className="explore-game-card__artist">{artistLine}</div>}
                          </>
                        ) : (
                          <div className="explore-game-card__unplayed">Play to reveal</div>
                        )}
                        <div className="explore-game-card__footer">
                          {genreColors && (
                            <span className="explore-game-card__genre" style={{ background: genreColors.bg, color: genreColors.text }}>
                              {p.genre}
                            </span>
                          )}
                          {played && <span className="explore-game-card__played-label">✓ Played</span>}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {GAMES.every(g => !byGame[g.slug]?.length) && (
            <p className="explore-empty">No puzzles found{activeGenres.length ? ' for selected genres' : ''}.</p>
          )}
        </div>
      )}
    </div>
  )
}

function CalNavBtn({ onClick, label, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} className="btn-press nav-btn" style={{
      width: 32, height: 32, background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '6px', color: disabled ? 'var(--text-dim)' : 'var(--text-muted)',
      cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontSize: '14px',
    }}>{label}</button>
  )
}
