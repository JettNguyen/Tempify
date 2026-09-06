import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { useGameTimer } from '../hooks/useGameTimer'
import { todayEST } from '../lib/date'
import { getPuzzle, getCachedPuzzle } from '../lib/puzzles'
import { findArtwork } from '../lib/deezer'
import { prefetchArtworkUrls } from '../lib/artwork'
import { saveScore, updateStreak } from '../lib/scores'
import { hapticImportantTap } from '../lib/haptics'
import AudioPlayer from '../components/AudioPlayer'
import ResultCard from '../components/ResultCard'
import TrackArtwork from '../components/TrackArtwork'
import DelayedSpinner from '../components/DelayedSpinner'
import './CoverOrNot.css'

export default function CoverOrNot() {
  const { user, profile } = useAuth()
  const { markComplete, isComplete, completions } = useCompletion(user?.id)
  const [searchParams] = useSearchParams()
  const dateParam = searchParams.get('date') || undefined
  const puzzleDate = dateParam || todayEST()

  // Seeded from the session cache the home screen warmed, so a tapped tile
  // paints the real screen immediately instead of an empty shell.
  const cachedPuzzle = getCachedPuzzle('cover-or-not', dateParam)
  const [puzzle, setPuzzle] = useState(cachedPuzzle)
  const [loading, setLoading] = useState(!cachedPuzzle)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [justFinished, setJustFinished] = useState(false)
  const [chosen, setChosen] = useState(null)
  const [correct, setCorrect] = useState(false)
  const [finalTime, setFinalTime] = useState(null)
  const [originalResultArtwork, setOriginalResultArtwork] = useState(null)
  const [shouldAutoplayOriginal, setShouldAutoplayOriginal] = useState(false)
  const coverRef = useRef(null)
  const originalRef = useRef(null)

  const { stop, display } = useGameTimer(!done, 250, `tempify_game_cover-or-not_${puzzleDate}`)

  useEffect(() => {
    // Already seeded from cache — refetching would only re-run derived
    // state (option order) and make the screen jump.
    if (cachedPuzzle) return
    getPuzzle('cover-or-not', dateParam)
      .then(setPuzzle)
      .catch(() => setError('No puzzle found for today.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!puzzle || done) return
    if (isComplete('cover-or-not', puzzleDate)) {
      stop()
      setCorrect(completions[`cover-or-not|${puzzleDate}`]?.completed ?? false)
      setShouldAutoplayOriginal(false)
      setDone(true)
    }
  }, [puzzle, completions])

  useEffect(() => {
    if (!puzzle) return

    let cancelled = false
    const metadata = puzzle.metadata || {}
    const existing = metadata.original_artwork_url || null
    if (existing) {
      setOriginalResultArtwork(existing)
      prefetchArtworkUrls([existing])
      return
    }

    if (puzzle.answer !== 'cover') return
    if (!metadata.original_title) return

    findArtwork({ title: metadata.original_title, artist: metadata.original_artist })
      .then((url) => {
        if (!cancelled && url) {
          setOriginalResultArtwork(url)
          prefetchArtworkUrls([url])
        }
      })
      .catch(() => {
        // Keep fallback UI if lookup fails.
      })

    return () => { cancelled = true }
  }, [puzzle])

  useEffect(() => {
    if (!done || !shouldAutoplayOriginal) return
    const id = setTimeout(() => {
      originalRef.current?.play()
      setShouldAutoplayOriginal(false)
    }, 100)
    return () => clearTimeout(id)
  }, [done, shouldAutoplayOriginal])

  async function handleGuess(pick) {
    if (done) return
    hapticImportantTap()
    const elapsed = stop()
    setFinalTime(elapsed)
    const isCorrect = pick === puzzle.answer
    setChosen(pick)
    setCorrect(isCorrect)
    setDone(true)
    setJustFinished(true)
    if (puzzle.answer === 'cover' && puzzle.metadata?.original_audio_url) {
      coverRef.current?.pause()
      setShouldAutoplayOriginal(true)
    }
    markComplete('cover-or-not', puzzleDate, 1, isCorrect)
    if (user) {
      try {
        await saveScore({ userId: user.id, gameSlug: 'cover-or-not', puzzleDate, attempts: 1, completed: isCorrect, timeSeconds: profile?.competitive_mode !== false ? elapsed : null })
        if (isCorrect) await updateStreak(user.id, 'cover-or-not', profile?.is_subscribed)
      } catch (err) {
        console.error('[Tempify] CoverOrNot score save error:', err.message)
      }
    }
  }

  if (loading) return <GameShell><DelayedSpinner active={loading} label="Loading puzzle..." /></GameShell>
  if (error) return <GameShell><p style={{ color: 'var(--text-muted)' }}>{error}</p></GameShell>
  if (!puzzle) return null

  const m = puzzle.metadata || {}
  const isCover = puzzle.answer === 'cover'

  return (
    <GameShell>
      <Link to={dateParam ? `/archive/${dateParam}` : '/'} replace className="game-back-link">← Back</Link>

      <div className="game-header">
        <p className="game-header__eyebrow">cover or not</p>
        <h1 className="game-header__title">Is this song a cover of an earlier track?</h1>
        {!done && profile?.competitive_mode !== false && <p className="game-timer">{display}</p>}
      </div>

      <div className="cover-or-not__song">
        <div className="cover-or-not__song-track">
          <TrackArtwork
            title={m.song_title}
            artist={m.song_artist}
            src={m.artwork_url || m.song_artwork_url}
            size="medium"
          />
          {m.song_title && (
            <div>
              <p className="cover-or-not__song-name">{m.song_title}</p>
              {m.song_artist && (
                <p className="cover-or-not__song-meta">
                  {m.song_artist}{m.song_year ? ` · ${m.song_year}` : ''}
                </p>
              )}
            </div>
          )}
        </div>
        <AudioPlayer ref={coverRef} src={puzzle.audio_url} onPlay={() => originalRef.current?.pause()} autoplay={profile?.autoplay_audio !== false} />
      </div>

      <div className="stagger-list cover-or-not__choices">
        {[{ value: 'cover', label: "It's a cover" }, { value: 'original', label: "It's original" }].map(({ value, label }) => {
          let mod = ''
          if (done) {
            if (value === puzzle.answer) mod = ' cover-or-not__choice-btn--correct'
            else if (value === chosen) mod = ' cover-or-not__choice-btn--wrong'
            else mod = ' cover-or-not__choice-btn--faded'
          }
          return (
            <button
              key={value}
              onClick={() => !done && handleGuess(value)}
              disabled={done}
              className={`cover-or-not__choice-btn btn-press${!done ? ' btn-hover' : ''}${mod}`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {done && (
        <ResultCard
          justFinished={justFinished}
          correct={correct}
          answer={isCover
            ? `It's a cover${m.original_title ? ` of "${m.original_title}"` : ''}${m.original_artist ? ` by ${m.original_artist}` : ''}`
            : "It's an original"
          }
          artwork={isCover ? {
            title: m.original_title,
            artist: m.original_artist,
            src: originalResultArtwork || m.original_artwork_url,
          } : undefined}
          detail={m.note || undefined}
          gameSlug="cover-or-not"
          puzzleDate={dateParam}
          timeSeconds={profile?.competitive_mode !== false ? finalTime : null}
          nextGame={{ path: '/', label: 'Back to games' }}
          showLeaderboard={profile?.competitive_mode !== false}
        >
          {isCover && (
            <div className="cover-or-not__original-reveal">
              <p className="cover-or-not__original-label">The original</p>
              {m.original_title && <p className="cover-or-not__original-name">{m.original_title}</p>}
              {m.original_artist && (
                <p className="cover-or-not__original-meta">
                  {m.original_artist}{m.original_year ? ` · ${m.original_year}` : ''}
                </p>
              )}
              {m.original_audio_url && (
                <AudioPlayer ref={originalRef} src={m.original_audio_url} onPlay={() => coverRef.current?.pause()} />
              )}
            </div>
          )}
        </ResultCard>
      )}
    </GameShell>
  )
}

function GameShell({ children }) {
  return <div className="page-shell">{children}</div>
}
