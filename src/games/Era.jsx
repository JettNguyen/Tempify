import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { useGameTimer } from '../hooks/useGameTimer'
import { todayEST, fmtDayShort } from '../lib/date'
import { DECADES, centuryOf } from '../lib/decades'
import { exitTarget } from '../lib/gameExit'
import { getPuzzle, getCachedPuzzle } from '../lib/puzzles'
import { findArtwork } from '../lib/deezer'
import { prefetchArtworkUrls } from '../lib/artwork'
import { saveScore, updateStreak } from '../lib/scores'
import { hapticImportantTap } from '../lib/haptics'
import { lockInDelay } from '../lib/lockIn'
import AudioPlayer from '../components/AudioPlayer'
import GameHeader from '../components/GameHeader'
import ResultCard from '../components/ResultCard'
import Icon from '../components/Icon'
import DelayedSpinner from '../components/DelayedSpinner'
import './choices.css'
import './Era.css'


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
  const revealRef = useRef(0)

  const { stop, display } = useGameTimer(hasStarted && !done, 250, `tempify_game_era_${puzzleDate}`)

  useEffect(() => {
    // Already seeded from cache, since refetching would only re-run derived
    // state (option order) and make the screen jump.
    if (cachedPuzzle) return
    getPuzzle('era', dateParam)
      .then(setPuzzle)
      .catch(() => setError('No puzzle found for today.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    // A pick still in its beat reveals itself when the beat is over.
    if (!puzzle || done || revealRef.current) return
    if (isComplete('era', puzzleDate)) {
      stop()
      const wasCorrect = completions[`era|${puzzleDate}`]?.completed ?? false
      setChosen(wasCorrect ? puzzle.answer : null)
      setCorrect(wasCorrect)
      setDone(true)
    }
  }, [puzzle, completions])

  useEffect(() => () => clearTimeout(revealRef.current), [])

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
    if (done || chosen) return
    hapticImportantTap()
    const elapsed = stop()
    setFinalTime(elapsed)
    const isCorrect = decade === puzzle.answer
    setChosen(decade)
    setCorrect(isCorrect)
    // Recorded at the tap rather than after the beat, so leaving during it
    // can't lose the answer.
    markComplete('era', puzzleDate, 1, isCorrect)
    revealRef.current = setTimeout(() => {
      setDone(true)
      setJustFinished(true)
    }, lockInDelay())
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

  let timer = null
  if (!done && profile?.competitive_mode !== false) {
    timer = hasStarted
      ? { text: display, running: !chosen }
      : { text: 'Starts on play', idle: true }
  }

  return (
    <GameShell>
      <Link to={exitTarget(searchParams)} replace className="game-back-link tap-target"><Icon name="chevronLeft" size={14} />Back</Link>

      <GameHeader
        slug="era"
        name="era"
        date={fmtDayShort(puzzleDate)}
        title="What decade is this song from?"
        timer={timer}
      />

      <AudioPlayer
        variant="stage"
        visual="record"
        src={puzzle.audio_url}
        onPlay={() => setHasStarted(true)}
        autoplay={profile?.autoplay_audio !== false}
      />

      <div className="choices era__decades">
        {DECADES.map((decade, i) => {
          const isAnswer = decade === puzzle.answer
          let mod = ''
          let mark = null
          if (done) {
            if (isAnswer) { mod = ' choice--correct'; mark = 'check' }
            else if (decade === chosen) { mod = ' choice--wrong'; mark = 'x' }
            else mod = ' choice--faded'
          } else if (chosen) {
            mod = decade === chosen ? ' choice--locked' : ' choice--waiting'
          }

          return (
            <button
              key={decade}
              type="button"
              onClick={() => handleGuess(decade)}
              disabled={done || Boolean(chosen)}
              className={`choice era__decade${mod}`}
              style={{ '--i': i }}
            >
              <span className="era__decade-century">{centuryOf(decade)}</span>
              <span className="era__decade-years">{decade}</span>
              {mark && (
                <span className="choice__mark">
                  <Icon name={mark} size={10} strokeWidth={3.5} />
                </span>
              )}
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
  return <div className="page-shell page-shell--fill game-theme--era">{children}</div>
}
