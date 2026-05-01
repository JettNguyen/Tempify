import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { useGameTimer } from '../hooks/useGameTimer'
import { todayEST } from '../lib/date'
import { getPuzzle } from '../lib/puzzles'
import { findArtwork } from '../lib/itunes'
import { prefetchArtworkUrls } from '../lib/artwork'
import { saveScore, updateStreak } from '../lib/scores'
import { hapticImportantTap } from '../lib/haptics'
import AudioPlayer from '../components/AudioPlayer'
import ResultCard from '../components/ResultCard'
import DelayedSpinner from '../components/DelayedSpinner'
import './Era.css'

const DECADES = ['60s', '70s', '80s', '90s', '00s', '10s', '20s']

export default function Era() {
  const { user, profile } = useAuth()
  const { markComplete, isComplete, completions } = useCompletion(user?.id)
  const [searchParams] = useSearchParams()
  const dateParam = searchParams.get('date') || undefined
  const puzzleDate = dateParam || todayEST()

  const [puzzle, setPuzzle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [chosen, setChosen] = useState(null)
  const [correct, setCorrect] = useState(false)
  const [finalTime, setFinalTime] = useState(null)
  const [resultArtwork, setResultArtwork] = useState(null)

  const { stop, display } = useGameTimer(hasStarted && !done, 250, `tempify_game_era_${puzzleDate}`)

  useEffect(() => {
    getPuzzle('era', dateParam)
      .then(setPuzzle)
      .catch(() => setError('No puzzle found for today.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!puzzle || done) return
    if (isComplete('era')) {
      stop()
      const wasCorrect = completions['era']?.completed ?? false
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
    markComplete('era', 1, isCorrect)
    if (user) {
      await saveScore({ userId: user.id, gameSlug: 'era', attempts: 1, completed: isCorrect, timeSeconds: elapsed })
      if (isCorrect) await updateStreak(user.id, 'era', profile?.is_subscribed)
    }
  }

  if (loading) return <GameShell><DelayedSpinner active={loading} label="Loading puzzle..." /></GameShell>
  if (error) return <GameShell><p style={{ color: 'var(--text-muted)' }}>{error}</p></GameShell>
  if (!puzzle) return null

  return (
    <GameShell>
      <Link to="/" className="game-back-link">← Back</Link>

      <div className="game-header">
        <p className="game-header__eyebrow">era</p>
        <h1 className="game-header__title">What decade is this song from?</h1>
        {!done && hasStarted && <p className="game-timer">{display}</p>}
        {!done && !hasStarted && <p className="game-timer">Press play to start timer</p>}
      </div>

      <AudioPlayer src={puzzle.audio_url} onPlay={() => setHasStarted(true)} />

      <div className="stagger-list era__decades">
        {DECADES.map((decade) => {
          const isChosen = chosen === decade
          const isAnswer = decade === puzzle.answer

          let cls = 'era__decade-btn btn-press'
          if (done) {
            cls += ' era__decade-btn--done'
            if (isAnswer) cls += ' era__decade-btn--answer'
            else cls += ' era__decade-btn--faded'
          } else {
            cls += ' btn-hover'
          }

          return (
            <button key={decade} onClick={() => handleGuess(decade)} disabled={done} className={cls}>
              {decade}
            </button>
          )
        })}
      </div>

      {done && (
        <ResultCard
          correct={correct}
          answer={puzzle.metadata?.title}
          artist={`${puzzle.metadata?.artist} · ${puzzle.metadata?.year}`}
          artwork={{
            title: puzzle.metadata?.title,
            artist: puzzle.metadata?.artist,
            src: resultArtwork || puzzle.metadata?.artwork_url,
          }}
          emojiGrid={correct ? '🟩' : '⬜'}
          gameSlug="era"
          puzzleDate={dateParam}
          timeSeconds={finalTime}
          nextGame={{ path: '/game/cover-or-not', label: 'Cover or Not' }}
        />
      )}
    </GameShell>
  )
}

function GameShell({ children }) {
  return <div className="page-shell">{children}</div>
}
