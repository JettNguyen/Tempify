import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { todayEST } from '../lib/date'
import { getPuzzle, getCachedPuzzle } from '../lib/puzzles'
import { findArtwork, stripVariant } from '../lib/deezer'
import { prefetchArtworkUrls } from '../lib/artwork'
import { saveScore, updateStreak } from '../lib/scores'
import { hapticImportantTap, hapticWrong, hapticRejected } from '../lib/haptics'
import AudioPlayer from '../components/AudioPlayer'
import GuessInput from '../components/GuessInput'
import ResultCard from '../components/ResultCard'
import DelayedSpinner from '../components/DelayedSpinner'
import './OneBar.css'

const MAX_ATTEMPTS = 6
const BASE_SECONDS = 0.5
const SECONDS_PER_REVEAL = 0.5
const REVEAL_TIMINGS = [0.5, 1, 2, 5, 15, 30]

const progressKey = (date) => `tempify_progress_one-bar_${date}`

export default function OneBar() {
  const { user, profile } = useAuth()
  const { markComplete, isComplete, completions } = useCompletion(user?.id)
  const [searchParams] = useSearchParams()
  const dateParam = searchParams.get('date') || undefined
  const puzzleDate = dateParam || todayEST()

  // Seeded from the session cache the home screen warmed, so a tapped tile
  // paints the real screen immediately instead of an empty shell.
  const cachedPuzzle = getCachedPuzzle('one-bar', dateParam)
  const [puzzle, setPuzzle] = useState(cachedPuzzle)
  const [loading, setLoading] = useState(!cachedPuzzle)
  const [error, setError] = useState(null)

  const guessInputRef = useRef(null)

  const [attempts, setAttempts] = useState([])
  const [done, setDone] = useState(false)
  const [justFinished, setJustFinished] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [revealSeconds, setRevealSeconds] = useState(BASE_SECONDS)
  const [resultArtwork, setResultArtwork] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    // Already seeded from cache — refetching would only re-run derived
    // state (option order) and make the screen jump.
    if (cachedPuzzle) return
    getPuzzle('one-bar', dateParam)
      .then(setPuzzle)
      .catch(() => setError('No puzzle found for today.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!puzzle || done) return
    if (isComplete('one-bar', puzzleDate)) {
      localStorage.removeItem(progressKey(puzzleDate))
      const stored = completions[`one-bar|${puzzleDate}`]
      const count = stored?.attempts || 1
      const wasCorrect = stored?.completed ?? false
      const fake = Array.from({ length: count }, (_, i) => ({
        title: i === count - 1 && wasCorrect ? puzzle.answer : '—',
        artist: '',
        correct: i === count - 1 && wasCorrect,
      }))
      setAttempts(fake)
      setCorrect(wasCorrect)
      setRevealSeconds(REVEAL_TIMINGS[Math.min(count - 1, REVEAL_TIMINGS.length - 1)])
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

    const title = puzzle.answer
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

  // Restore mid-game guesses from localStorage so navigating away doesn't let
  // the player restart with a clean slate.
  useEffect(() => {
    if (!puzzle || done) return
    if (isComplete('one-bar', puzzleDate)) return
    try {
      const saved = JSON.parse(localStorage.getItem(progressKey(puzzleDate)) || 'null')
      if (saved?.attempts?.length > 0) {
        setAttempts(saved.attempts)
        setRevealSeconds(saved.revealSeconds ?? BASE_SECONDS)
      }
    } catch { /* ignore corrupt data */ }
  }, [puzzle, completions])

  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(null), 2500)
    return () => clearTimeout(id)
  }, [notice])

  function buildEmojiGrid() {
    return attempts.map((a) => (a.correct ? '🟩' : '⬜')).join('')
  }

  async function registerAttempt(attempt) {
    const newAttempts = [...attempts, attempt]
    setAttempts(newAttempts)

    if (attempt.correct || newAttempts.length >= MAX_ATTEMPTS) {
      setCorrect(attempt.correct)
      setDone(true)
      setJustFinished(true)
      localStorage.removeItem(progressKey(puzzleDate))
      markComplete('one-bar', puzzleDate, newAttempts.length, attempt.correct)
      if (user) {
        try {
          await saveScore({ userId: user.id, gameSlug: 'one-bar', puzzleDate, attempts: newAttempts.length, completed: attempt.correct })
          if (attempt.correct) await updateStreak(user.id, 'one-bar')
        } catch (err) {
          console.error('[Tempify] OneBar score save error:', err.message)
        }
      }
    } else {
      // Wrong, but the round continues — distinct from the failure buzz the
      // result card fires when the last guess is spent.
      if (!attempt.skipped) hapticWrong()
      guessInputRef.current?.clear()
      const nextReveal = REVEAL_TIMINGS[Math.min(newAttempts.length, REVEAL_TIMINGS.length - 1)]
      setRevealSeconds(nextReveal)
      localStorage.setItem(progressKey(puzzleDate), JSON.stringify({ attempts: newAttempts, revealSeconds: nextReveal }))
    }
  }

  async function handleGuess(song) {
    if (done || attempts.length >= MAX_ATTEMPTS) return

    // A repeat guess tells the player nothing new, so don't let it burn a turn.
    const guessKey = `${stripVariant(song.title).toLowerCase()}|||${song.artist.toLowerCase()}`
    const isRepeat = attempts.some((a) => (
      !a.skipped && `${stripVariant(a.title || '').toLowerCase()}|||${(a.artist || '').toLowerCase()}` === guessKey
    ))
    if (isRepeat) {
      hapticRejected()
      setNotice(`You already guessed “${song.title}”.`)
      guessInputRef.current?.clear()
      return
    }

    setNotice(null)
    hapticImportantTap()

    const titleMatch = stripVariant(song.title).toLowerCase() === puzzle.answer.toLowerCase().trim()
    const artistMatch = !puzzle.metadata?.artist ||
      song.artist.toLowerCase().trim() === puzzle.metadata.artist.toLowerCase().trim()
    const isCorrect = titleMatch && artistMatch

    await registerAttempt({ title: song.title, artist: song.artist, correct: isCorrect })
  }

  async function handleSkip() {
    if (done || attempts.length >= MAX_ATTEMPTS) return
    hapticImportantTap()

    await registerAttempt({ title: 'Skipped', artist: '', correct: false, skipped: true })
  }

  if (loading) return <GameShell><DelayedSpinner active={loading} label="Loading puzzle..." /></GameShell>
  if (error) return <GameShell><p style={{ color: 'var(--text-muted)' }}>{error}</p></GameShell>
  if (!puzzle) return null

  const remainingGuesses = MAX_ATTEMPTS - attempts.length

  return (
    <GameShell>
      <Link to={dateParam ? `/archive/${dateParam}` : '/'} replace className="game-back-link">← Back</Link>

      <div className="one-bar__header">
        <p className="one-bar__eyebrow">one bar</p>
        <h1 className="one-bar__title">
          Name the song from a short clip. Each wrong guess unlocks a bit more.
        </h1>
      </div>

      <AudioPlayer key={done ? 'done' : 'playing'} src={puzzle.audio_url} maxDuration={done ? undefined : revealSeconds} autoplay={done ? true : profile?.autoplay_audio !== false} />

      <div className="one-bar__progress">
        <div className="one-bar__bars">
          {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => {
            const attempt = attempts[i]
            return (
              <div
                key={i}
                className={`one-bar__bar${attempt ? attempt.correct ? ' one-bar__bar--correct' : ' one-bar__bar--used' : ''}`}
              />
            )
          })}
        </div>
        <p className="one-bar__progress-label">
          {done
            ? correct
              ? `Got it in ${attempts.length} ${attempts.length === 1 ? 'guess' : 'guesses'}`
              : 'Better luck tomorrow'
            : `${remainingGuesses} ${remainingGuesses === 1 ? 'guess' : 'guesses'} left · ${revealSeconds}s unlocked`}
        </p>
      </div>

      {!done && (
        <>
          <GuessInput ref={guessInputRef} onGuess={handleGuess} disabled={done} />
          {notice && <p className="one-bar__notice" role="status">{notice}</p>}
          <button type="button" onClick={handleSkip} className="one-bar__skip btn-press">
            Skip — unlock more audio
          </button>
        </>
      )}

      {attempts.length > 0 && !done && (
        <div className="one-bar__guesses">
          {attempts.map((a, i) => (
            <div key={i} className="one-bar__guess-row">
              <span className="one-bar__guess-x">✕</span>
              <span>{a.skipped ? 'Skipped' : `${a.title} by ${a.artist}`}</span>
            </div>
          ))}
        </div>
      )}

      {done && (
        <ResultCard
          justFinished={justFinished}
          correct={correct}
          answer={puzzle.answer}
          artist={puzzle.metadata?.artist}
          artwork={{
            title: puzzle.answer,
            artist: puzzle.metadata?.artist,
            src: resultArtwork || puzzle.metadata?.artwork_url,
          }}
          emojiGrid={buildEmojiGrid()}
          attempts={attempts.length}
          gameSlug="one-bar"
          puzzleDate={dateParam}
          nextGame={{ path: '/game/hit-or-miss', label: 'Hit or Miss' }}
          showLeaderboard={profile?.competitive_mode !== false}
        />
      )}
    </GameShell>
  )
}

function GameShell({ children }) {
  return <div className="page-shell">{children}</div>
}
