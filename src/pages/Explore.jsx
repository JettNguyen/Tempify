import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { supabase } from '../lib/supabase'
import { todayEST } from '../lib/date'
import { GENRES, GENRE_COLORS } from '../lib/genres'
import { ALL_GAMES } from '../lib/games'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { hapticSelection } from '../lib/haptics'
import Icon from '../components/Icon'
import ArchiveLock from '../components/ArchiveLock'
import DelayedSpinner from '../components/DelayedSpinner'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'
import './Explore.css'
import './Archive.css'

const FIRST_PUZZLE_DATE = '2026-04-28'
const WHEEL_LINE_PX = 16
const WHEEL_SMOOTH_FACTOR = 0.2
const WHEEL_STOP_EPSILON = 0.5

const horizontalScrollState = new WeakMap()

function updateScrollGradient(el) {
  if (!el) return
  const atStart = el.scrollLeft <= 1
  const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2
  const noOverflow = el.scrollWidth <= el.clientWidth + 2
  let mask
  if (noOverflow) {
    mask = 'none'
  } else if (atStart) {
    mask = 'linear-gradient(to right, black 0, black calc(100% - 48px), transparent 100%)'
  } else if (atEnd) {
    mask = 'linear-gradient(to right, transparent 0, black 48px, black 100%)'
  } else {
    mask = 'linear-gradient(to right, transparent 0, black 48px, black calc(100% - 48px), transparent 100%)'
  }
  el.style.webkitMaskImage = mask
  el.style.maskImage = mask
}

function isDesktopPointer() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

function getWheelDelta(e) {
  // Prefer explicit horizontal delta when present, otherwise map vertical wheel to x.
  const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
  if (e.deltaMode === 1) return raw * WHEEL_LINE_PX
  if (e.deltaMode === 2) return raw * window.innerHeight
  return raw
}

function canScrollHorizontally(el, delta) {
  if (!el || el.scrollWidth <= el.clientWidth) return false
  const atStart = el.scrollLeft <= 0
  const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
  if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return false
  return true
}

function smoothScrollHorizontally(el, delta) {
  if (!el || !delta) return

  const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth)
  if (maxScroll <= 0) return

  const state = horizontalScrollState.get(el) || { target: el.scrollLeft, rafId: null }
  state.target = Math.min(maxScroll, Math.max(0, state.target + delta))

  if (state.rafId === null) {
    const step = () => {
      const next = el.scrollLeft + (state.target - el.scrollLeft) * WHEEL_SMOOTH_FACTOR
      el.scrollLeft = next
      updateScrollGradient(el)

      if (Math.abs(state.target - el.scrollLeft) <= WHEEL_STOP_EPSILON) {
        el.scrollLeft = state.target
        updateScrollGradient(el)
        state.rafId = null
        horizontalScrollState.set(el, state)
        return
      }

      state.rafId = requestAnimationFrame(step)
      horizontalScrollState.set(el, state)
    }

    state.rafId = requestAnimationFrame(step)
  }

  horizontalScrollState.set(el, state)
}

function getDisplayArtist(puzzle) {
  if (puzzle.game_slug === 'sampled')
    return puzzle.metadata?.sample_artist || puzzle.metadata?.options?.[0]?.artist || null
  return puzzle.metadata?.song_artist || puzzle.metadata?.artist || null
}

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
  const { isComplete } = useCompletion(user?.id)
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('view') || 'browse'
  const setView = (v) => {
    hapticSelection()
    setSearchParams(v === 'browse' ? {} : { view: v }, { replace: true })
  }
  const [activeGenres, setActiveGenres] = useState([])
  const [allPuzzles, setAllPuzzles] = useState([])
  const [playedSlugs, setPlayedSlugs] = useState(new Set())
  const [fetching, setFetching] = useState(true)

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  // -1 back, 1 forward, 0 on first paint so opening the calendar doesn't slide.
  const [monthDir, setMonthDir] = useState(0)
  const todayStr = todayEST()
  const todayCalStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

  const pillsRef = useRef(null)
  useEffect(() => {
    const el = pillsRef.current
    if (!el || !isDesktopPointer()) return
    updateScrollGradient(el)
    const onWheel = (e) => {
      const delta = getWheelDelta(e)
      if (!canScrollHorizontally(el, delta)) return
      e.preventDefault()
      smoothScrollHorizontally(el, delta)
    }
    const onScroll = () => updateScrollGradient(el)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('scroll', onScroll)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('scroll', onScroll)
    }
  }, [])
  useEffect(() => {
    if (pillsRef.current) updateScrollGradient(pillsRef.current)
  }, [activeGenres])

  const gamesRef = useRef(null)
  useEffect(() => {
    const el = gamesRef.current
    if (!el || !isDesktopPointer()) return
    requestAnimationFrame(() => {
      el.querySelectorAll('.explore-game-row__scroll').forEach(updateScrollGradient)
    })
    const onWheel = (e) => {
      if (!(e.target instanceof Element)) return
      const row = e.target.closest('.explore-game-row__scroll')
      if (!row) return
      const delta = getWheelDelta(e)
      if (!canScrollHorizontally(row, delta)) return
      e.preventDefault()
      smoothScrollHorizontally(row, delta)
    }
    const onScroll = (e) => {
      if (e.target.classList?.contains('explore-game-row__scroll')) {
        updateScrollGradient(e.target)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('scroll', onScroll, { capture: true })
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('scroll', onScroll, { capture: true })
    }
  }, [allPuzzles])

  const fetchData = useCallback(async () => {
    const [scoresRes, puzzlesRes] = await Promise.all([
      user ? supabase.from('scores').select('game_slug, date_played').eq('user_id', user.id) : Promise.resolve({ data: null }),
      supabase.from('puzzles')
        .select('id, game_slug, scheduled_date, answer, genre, metadata')
        .lte('scheduled_date', todayStr)
        .order('scheduled_date', { ascending: false }),
    ])
    if (scoresRes.data?.length) setPlayedSlugs(new Set(scoresRes.data.map(s => `${s.date_played}|${s.game_slug}`)))
    setAllPuzzles(puzzlesRes.data || [])
  }, [user, todayStr])

  useEffect(() => {
    setFetching(true)
    fetchData().finally(() => setFetching(false))
  }, [fetchData])

  const { pullDistance, isRefreshing, isDragging } = usePullToRefresh(fetchData)

  if (loading) return null

  const isSubscribed = Boolean(user && profile?.is_subscribed)

  function toggleGenre(g) {
    setActiveGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
  }

  const filtered = activeGenres.length === 0
    ? allPuzzles
    : allPuzzles.filter(p => p.genre && activeGenres.includes(p.genre))

  const byGame = {}
  ALL_GAMES.forEach(g => { byGame[g.slug] = [] })
  filtered.forEach(p => {
    if (byGame[p.game_slug]) byGame[p.game_slug].push(p)
  })

  // Calendar
  const firstPuzzle = new Date(FIRST_PUZZLE_DATE + 'T12:00:00')
  const isEarliestMonth = viewYear === firstPuzzle.getFullYear() && viewMonth === firstPuzzle.getMonth()
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth()
  const monthName = new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const slideClass = monthDir === 0 ? '' : monthDir > 0 ? ' cal-slide-from-right' : ' cal-slide-from-left'
  const days = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)

  // Per-date puzzle counts (unfiltered — calendar always shows full picture)
  const puzzlesByDate = {}
  allPuzzles.forEach(p => { puzzlesByDate[p.scheduled_date] = (puzzlesByDate[p.scheduled_date] || 0) + 1 })

  // Per-date played counts from the Supabase scores set
  const playedByDate = {}
  playedSlugs.forEach(key => {
    const [date] = key.split('|')
    playedByDate[date] = (playedByDate[date] || 0) + 1
  })

  function prevMonth() {
    if (isEarliestMonth) return
    hapticSelection()
    setMonthDir(-1)
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (isCurrentMonth) return
    hapticSelection()
    setMonthDir(1)
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  return (
    <div
      className="page-shell-wide"
      style={{
        transform: `translateY(${pullDistance}px)`,
        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      }}
    >
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div className="explore-header">
        <p className="explore-eyebrow">explore</p>
        <div className="explore-title-row">
          <h1 className="explore-title">Browse puzzles</h1>
          <div className="explore-view-toggle">
            <button
              onClick={() => setView('browse')}
              className={`explore-view-btn btn-press${view === 'browse' ? ' explore-view-btn--active' : ''}`}
            ><Icon name="grid" size={13} />Browse</button>
            <button
              onClick={() => setView('calendar')}
              className={`explore-view-btn btn-press${view === 'calendar' ? ' explore-view-btn--active' : ''}`}
            ><Icon name="calendar" size={13} />Calendar</button>
          </div>
        </div>
      </div>

      <div className="explore-pills" ref={pillsRef}>
        {GENRES.map(g => {
          const active = activeGenres.includes(g)
          const colors = GENRE_COLORS[g]
          return (
            <button
              key={g}
              onClick={() => { hapticSelection(); toggleGenre(g) }}
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
            onClick={() => { hapticSelection(); setActiveGenres([]) }}
            className="btn-press btn-hover"
            style={{ padding: '6px 13px', borderRadius: '999px', border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >Clear ✕</button>
        )}
      </div>

      {!isSubscribed ? (
        <ArchiveLock />
      ) : view === 'calendar' ? (
        <div className="explore-cal">
          <div className="explore-cal-header">
            <h2 key={`${viewYear}-${viewMonth}`} className={`explore-cal-title${slideClass}`}>{monthName}</h2>
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
          <div key={`${viewYear}-${viewMonth}`} className={`archive-grid${slideClass}`}>
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e-${i}`} className="archive-day-filler" />
            ))}
            {Array.from({ length: days }).map((_, i) => {
              const day = i + 1
              const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
              const isToday = dateStr === todayCalStr
              const isFuture = dateStr > todayCalStr
              const hasPuzzles = dateStr >= FIRST_PUZZLE_DATE && !isFuture

              const totalGames = puzzlesByDate[dateStr] || 0
              const playedCount = playedByDate[dateStr] || 0
              const dotState = !hasPuzzles || totalGames === 0
                ? null
                : playedCount >= totalGames
                  ? 'complete'
                  : playedCount > 0
                    ? 'partial'
                    : 'unplayed'

              if (isFuture) return (
                <div key={day} className="archive-day archive-day--future">
                  <span className="archive-day__num archive-day__num--future">{day}</span>
                </div>
              )
              if (isToday) return (
                <Link key={day} to={`/archive/${dateStr}`} className="archive-day archive-day--today day-hover btn-press">
                  <span className="archive-day__num archive-day__num--today">{day}</span>
                  {dotState && <span className={`archive-day__dot archive-day__dot--${dotState}`} />}
                </Link>
              )
              return (
                <Link key={day} to={`/archive/${dateStr}`} className={`archive-day day-hover btn-press${!hasPuzzles ? ' archive-day--pre-launch' : ''}`}>
                  <span className="archive-day__num archive-day__num--past">{day}</span>
                  {dotState && <span className={`archive-day__dot archive-day__dot--${dotState}`} />}
                </Link>
              )
            })}
            {/* Months run 4-6 weeks; padding to a fixed six rows keeps the
                calendar a constant height so switching months doesn't jump. */}
            {Array.from({ length: Math.max(0, 42 - firstDay - days) }).map((_, i) => (
              <div key={`t-${i}`} className="archive-day-filler" />
            ))}
          </div>
          <div className="archive-legend">
            <div className="archive-legend__item">
              <span className="archive-day__dot archive-day__dot--complete" />
              <span>All done</span>
            </div>
            <div className="archive-legend__item">
              <span className="archive-day__dot archive-day__dot--partial" />
              <span>In progress</span>
            </div>
            <div className="archive-legend__item">
              <span className="archive-day__dot archive-day__dot--unplayed" />
              <span>Not played</span>
            </div>
          </div>
        </div>
      ) : fetching ? (
        <DelayedSpinner active={fetching} label="Loading puzzles..." />
      ) : (
        <div className="explore-games" ref={gamesRef}>
          {ALL_GAMES.map(game => {
            const puzzles = byGame[game.slug]
            if (!puzzles?.length) return null
            return (
              <div key={game.slug} className="explore-game-row">
                <h2 className="explore-game-row__title">{game.name}</h2>
                <div className="explore-game-row__scroll">
                  {puzzles.map(p => {
                    const played = playedSlugs.has(`${p.scheduled_date}|${p.game_slug}`)
                      || isComplete(p.game_slug, p.scheduled_date)
                    const gameLink = `${game.path}?date=${p.scheduled_date}`
                    const dateStr = new Date(p.scheduled_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    const answer = getDisplayAnswer(p)
                    const artistLine = getDisplayArtist(p)
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
          {ALL_GAMES.every(g => !byGame[g.slug]?.length) && (
            <p className="explore-empty">No puzzles found{activeGenres.length ? ' for selected genres' : ''}.</p>
          )}
        </div>
      )}
    </div>
  )
}

function CalNavBtn({ onClick, label, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} className="btn-press nav-btn tap-target" style={{
      width: 32, height: 32, background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '6px', color: disabled ? 'var(--text-dim)' : 'var(--text-muted)',
      cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontSize: '14px',
    }}>{label}</button>
  )
}
