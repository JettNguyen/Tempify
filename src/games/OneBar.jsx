import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { todayEST } from '../lib/date'
import { getPuzzle } from '../lib/puzzles'
import { findArtwork, stripVariant } from '../lib/itunes'
import { prefetchArtworkUrls } from '../lib/artwork'
import { saveScore, updateStreak } from '../lib/scores'
import { hapticImportantTap } from '../lib/haptics'
import AudioPlayer from '../components/AudioPlayer'
import GuessInput from '../components/GuessInput'
import ResultCard from '../components/ResultCard'
import DelayedSpinner from '../components/DelayedSpinner'
import './OneBar.css'

const MAX_ATTEMPTS = 6
const BASE_SECONDS = 0.5
const SECONDS_PER_REVEAL = 0.5
const REVEAL_TIMINGS = [0.5, 1, 2, 5, 15, 30]

export default function OneBar() {
  const { user, profile } = useAuth()
  const { markComplete, isComplete, completions } = useCompletion(user?.id)
  const [searchParams] = useSearchParams()
  const dateParam = searchParams.get('date') || undefined
  const puzzleDate = dateParam || todayEST()

  const [puzzle, setPuzzle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const guessInputRef = useRef(null)

  const [attempts, setAttempts] = useState([])
  const [done, setDone] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [revealSeconds, setRevealSeconds] = useState(BASE_SECONDS)
  const [resultArtwork, setResultArtwork] = useState(null)

  useEffect(() => {
    getPuzzle('one-bar', dateParam)
      .then(setPuzzle)
      .catch(() => setError('No puzzle found for today.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!puzzle || done) return
    if (isComplete('one-bar', puzzleDate)) {
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

  function buildEmojiGrid() {
    return attempts.map((a) => (a.correct ? '🟩' : '⬜')).join('')
  }

  async function handleGuess(song) {
    if (done || attempts.length >= MAX_ATTEMPTS) return
    hapticImportantTap()

    const titleMatch = stripVariant(song.title).toLowerCase() === puzzle.answer.toLowerCase().trim()
    const artistMatch = !puzzle.metadata?.artist ||
      song.artist.toLowerCase().trim() === puzzle.metadata.artist.toLowerCase().trim()
    const isCorrect = titleMatch && artistMatch

    const newAttempts = [...attempts, { title: song.title, artist: song.artist, correct: isCorrect }]
    setAttempts(newAttempts)

    if (isCorrect || newAttempts.length >= MAX_ATTEMPTS) {
      setCorrect(isCorrect)
      setDone(true)
      markComplete('one-bar', puzzleDate, newAttempts.length, isCorrect)
      if (user) {
        await saveScore({ userId: user.id, gameSlug: 'one-bar', puzzleDate, attempts: newAttempts.length, completed: isCorrect })
        if (isCorrect) await updateStreak(user.id, 'one-bar')
      }
    } else {
      guessInputRef.current?.clear()
      setRevealSeconds(REVEAL_TIMINGS[Math.min(newAttempts.length, REVEAL_TIMINGS.length - 1)])
    }
  }

  if (loading) return <GameShell><DelayedSpinner active={loading} label="Loading puzzle..." /></GameShell>
  if (error) return <GameShell><p style={{ color: 'var(--text-muted)' }}>{error}</p></GameShell>
  if (!puzzle) return null

  const remainingGuesses = MAX_ATTEMPTS - attempts.length

  return (
    <GameShell>
      <Link to="/" className="game-back-link">← Back</Link>

      <div className="one-bar__header">
        <p className="one-bar__eyebrow">one bar</p>
        <h1 className="one-bar__title">
          Name the song from a short clip. Each wrong guess unlocks a bit more.
        </h1>
      </div>

      <AudioPlayer src={puzzle.audio_url} maxDuration={done ? undefined : revealSeconds} autoplay={profile?.autoplay_audio !== false} />

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
        <GuessInput ref={guessInputRef} onGuess={handleGuess} disabled={done} />
      )}

      {attempts.length > 0 && !done && (
        <div className="one-bar__guesses">
          {attempts.map((a, i) => (
            <div key={i} className="one-bar__guess-row">
              <span className="one-bar__guess-x">✕</span>
              <span>{a.title} by {a.artist}</span>
            </div>
          ))}
        </div>
      )}

      {done && (
        <ResultCard
          correct={correct}
          answer={puzzle.answer}
          artist={puzzle.metadata?.artist}
          artwork={{
            title: puzzle.answer,
            artist: puzzle.metadata?.artist,
            src: resultArtwork || puzzle.metadata?.artwork_url,
          }}
          emojiGrid={buildEmojiGrid()}
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
