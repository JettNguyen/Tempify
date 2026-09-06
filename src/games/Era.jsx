import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { useGameTimer } from '../hooks/useGameTimer'
import { todayEST, fmtDayShort } from '../lib/date'
import { exitTarget } from '../lib/gameExit'
import { getPuzzle, getCachedPuzzle } from '../lib/puzzles'
import { findArtwork } from '../lib/deezer'
import { prefetchArtworkUrls } from '../lib/artwork'
import { saveScore, updateStreak } from '../lib/scores'
import { hapticImportantTap } from '../lib/haptics'
import AudioPlayer from '../components/AudioPlayer'
import ResultCard from '../components/ResultCard'
import DelayedSpinner from '../components/DelayedSpinner'
import './Era.css'

const DECADES = ['60s', '70s', '80s', '90s', '00s', '10s', '20s']
// Split so the century can sit small above the years — a plain "60s" gives the
// eye nothing to catch on, and seven identical pills read as a list of nothing.
const centuryOf = (decade) => (Number(decade.slice(0, 2)) >= 60 ? '19' : '20')

export default function Era() {
  const { user, profile } = useAuth()
  const { markComplete, isComplete, completions } = useCompletion(user?.id)
  const [searchParams] = useSearchParams()
  const dateParam = searchParams.get('date') || undefined
  const puzzleDate = dateParam || todayEST()

  // Seeded from the session cache the home screen warmed, so a tapped tile
  // paints the real screen immediately instead of an empty shell.
  const cachedPuzzle = getCachedPuzzle('era', dateParam)
  const [puzzle, setPuzzle] = useState(cachedPuzzle)
  const [loading, setLoading] = useState(!cachedPuzzle)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [justFinished, setJustFinished] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [chosen, setChosen] = useState(null)
  const [correct, setCorrect] = useState(false)
  const [finalTime, setFinalTime] = useState(null)
  const [resultArtwork, setResultArtwork] = useState(null)

  const { stop, display } = useGameTimer(hasStarted && !done, 250, `tempify_game_era_${puzzleDate}`)

  useEffect(() => {
    // Already seeded from cache — refetching would only re-run derived
    // state (option order) and make the screen jump.
    if (cachedPuzzle) return
    getPuzzle('era', dateParam)
      .then(setPuzzle)
      .catch(() => setError('No puzzle found for today.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!puzzle || done) return
    if (isComplete('era', puzzleDate)) {
      stop()
      const wasCorrect = completions[`era|${puzzleDate}`]?.completed ?? false
      setChosen(wasCorrect ? puzzle.answer : null)
      setCorrect(wasCorrect)
      setDone(true)
    }
  }, [puzzle, completions])

  useEffect(() => {
    if (!puzzle) return

    let cancelled = false
    const existing = puzzle.metadata?.artwork_url || null
    if (existing) {
      setResultArtwork(existing)
      prefetchArtworkUrls([existing])
      return
    }

    const title = puzzle.metadata?.title
    const artist = puzzle.metadata?.artist
    if (!title) return

    findArtwork({ title, artist })
      .then((url) => {
        if (!cancelled && url) {
          setResultArtwork(url)
          prefetchArtworkUrls([url])
        }
      })
      .catch(() => {
        // Keep fallback UI if lookup fails.
      })

    return () => { cancelled = true }
  }, [puzzle])

  async function handleGuess(decade) {
    if (done) return
    hapticImportantTap()
    const elapsed = stop()
    setFinalTime(elapsed)
    const isCorrect = decade === puzzle.answer
    setChosen(decade)
    setCorrect(isCorrect)
    setDone(true)
    setJustFinished(true)
    markComplete('era', puzzleDate, 1, isCorrect)
    if (user) {
      try {
        await saveScore({ userId: user.id, gameSlug: 'era', puzzleDate, attempts: 1, completed: isCorrect, timeSeconds: profile?.competitive_mode !== false ? elapsed : null })
        if (isCorrect) await updateStreak(user.id, 'era', profile?.is_subscribed)
      } catch (err) {
        console.error('[Tempify] Era score save error:', err.message)
      }
    }
  }

  if (loading) return <GameShell><DelayedSpinner active={loading} label="Loading puzzle..." /></GameShell>
  if (error) return <GameShell><p style={{ color: 'var(--text-muted)' }}>{error}</p></GameShell>
  if (!puzzle) return null

  return (
    <GameShell>
      <Link to={exitTarget(searchParams)} replace className="game-back-link">← Back</Link>

      <div className="game-header">
        <p className="game-header__eyebrow">era<span className="puzzle-date">{fmtDayShort(puzzleDate)}</span></p>
        <h1 className="game-header__title">What decade is this song from?</h1>
        {!done && profile?.competitive_mode !== false && hasStarted && <p className="game-timer">{display}</p>}
        {!done && profile?.competitive_mode !== false && !hasStarted && <p className="game-timer">Press play to start timer</p>}
      </div>

      <AudioPlayer src={puzzle.audio_url} onPlay={() => setHasStarted(true)} autoplay={profile?.autoplay_audio !== false} />

      <div className="stagger-list era__decades">
        {DECADES.map((decade) => {
          const isChosen = chosen === decade
          const isAnswer = decade === puzzle.answer

          let cls = 'era__decade-btn btn-press'
          if (done) {
            cls += ' era__decade-btn--done'
            // isChosen was worked out here and never used, so a wrong answer
            // looked exactly like the five decades you didn't pick.
            if (isAnswer) cls += ' era__decade-btn--answer'
            else if (isChosen) cls += ' era__decade-btn--wrong'
            else cls += ' era__decade-btn--faded'
          }

          return (
            <button key={decade} onClick={() => handleGuess(decade)} disabled={done} className={cls}>
              <span className="era__decade-century">{centuryOf(decade)}</span>
              <span className="era__decade-years">{decade}</span>
            </button>
          )
        })}
      </div>

      {done && (
        <ResultCard
          justFinished={justFinished}
          correct={correct}
          answer={puzzle.metadata?.title}
          artist={`${puzzle.metadata?.artist} · ${puzzle.metadata?.year}`}
          artwork={{
            title: puzzle.metadata?.title,
            artist: puzzle.metadata?.artist,
            src: resultArtwork || puzzle.metadata?.artwork_url,
          }}
          gameSlug="era"
          puzzleDate={dateParam}
          timeSeconds={profile?.competitive_mode !== false ? finalTime : null}
          nextGame={{ path: '/game/cover-or-not', label: 'Cover or Not' }}
          showLeaderboard={profile?.competitive_mode !== false}
        />
      )}
    </GameShell>
  )
}

function GameShell({ children }) {
  return <div className="page-shell">{children}</div>
}
