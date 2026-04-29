import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { getPuzzle } from '../lib/puzzles'
import { saveScore, updateStreak } from '../lib/scores'
import AudioPlayer from '../components/AudioPlayer'
import GuessInput from '../components/GuessInput'
import ResultCard from '../components/ResultCard'

const MAX_ATTEMPTS = 6
const BASE_SECONDS = 0.5
const SECONDS_PER_REVEAL = 1.5

export default function OneBar() {
  const { user } = useAuth()
  const { markComplete, isComplete, completions } = useCompletion(user?.id)

  const [puzzle, setPuzzle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [attempts, setAttempts] = useState([])
  const [done, setDone] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [revealSeconds, setRevealSeconds] = useState(BASE_SECONDS)

  useEffect(() => {
    getPuzzle('one-bar')
      .then(setPuzzle)
      .catch(() => setError('No puzzle found for today.'))
      .finally(() => setLoading(false))
  }, [])

  // Restore completed state if user already played today
  useEffect(() => {
    if (!puzzle || done) return
    if (isComplete('one-bar')) {
      const stored = completions['one-bar']
      const count = stored?.attempts || 1
      const wasCorrect = stored?.completed ?? false
      // Build a placeholder attempts array so the progress bar renders correctly
      const fake = Array.from({ length: count }, (_, i) => ({
        title: i === count - 1 && wasCorrect ? puzzle.answer : '—',
        artist: '',
        correct: i === count - 1 && wasCorrect,
      }))
      setAttempts(fake)
      setCorrect(wasCorrect)
      setRevealSeconds(Math.min(BASE_SECONDS + (count - 1) * SECONDS_PER_REVEAL, 21))
      setDone(true)
    }
  }, [puzzle, completions])

  function buildEmojiGrid() {
    return attempts.map((a) => (a.correct ? '🟩' : '⬜')).join('')
  }

  async function handleGuess(song) {
    if (done || attempts.length >= MAX_ATTEMPTS) return

    const isCorrect =
      song.title.toLowerCase().trim() === puzzle.answer.toLowerCase().trim()

    const newAttempts = [...attempts, { title: song.title, artist: song.artist, correct: isCorrect }]
    setAttempts(newAttempts)

    if (isCorrect || newAttempts.length >= MAX_ATTEMPTS) {
      setCorrect(isCorrect)
      setDone(true)
      markComplete('one-bar', newAttempts.length)
      if (user) {
        await saveScore({ userId: user.id, gameSlug: 'one-bar', attempts: newAttempts.length, completed: isCorrect })
        if (isCorrect) await updateStreak(user.id, 'one-bar')
      }
    } else {
      // Reveal more audio
      setRevealSeconds(Math.min(BASE_SECONDS + newAttempts.length * SECONDS_PER_REVEAL, 21))
    }
  }

  if (loading) return <GameShell><p style={{ color: 'var(--text-muted)' }}>Loading...</p></GameShell>
  if (error) return <GameShell><p style={{ color: 'var(--text-muted)' }}>{error}</p></GameShell>
  if (!puzzle) return null

  const remainingGuesses = MAX_ATTEMPTS - attempts.length

  return (
    <GameShell>
      <Link
        to="/"
        style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'inline-block', marginBottom: '1.5rem' }}
      >
        ← Back
      </Link>
      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          one bar
        </p>
        <h1 style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
          Name the song from a short clip. Each wrong guess unlocks a bit more.
        </h1>
      </div>

      <AudioPlayer src={puzzle.audio_url} maxDuration={revealSeconds} />

      <div style={{ marginTop: '0.5rem', marginBottom: '1.25rem' }}>
        <div style={{
          display: 'flex',
          gap: '4px',
          marginTop: '0.75rem',
        }}>
          {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => {
            const attempt = attempts[i]
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: '4px',
                  borderRadius: '2px',
                  background: attempt
                    ? attempt.correct
                      ? 'var(--green)'
                      : 'var(--text-dim)'
                    : 'var(--border)',
                }}
              />
            )
          })}
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
          {done
            ? correct
              ? `Got it in ${attempts.length} ${attempts.length === 1 ? 'guess' : 'guesses'}`
              : 'Better luck tomorrow'
            : `${remainingGuesses} ${remainingGuesses === 1 ? 'guess' : 'guesses'} left · ${revealSeconds}s unlocked`}
        </p>
      </div>

      {!done && (
        <GuessInput onGuess={handleGuess} disabled={done} />
      )}

      {/* Previous guesses */}
      {attempts.length > 0 && !done && (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {attempts.map((a, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              color: 'var(--text-muted)',
              padding: '6px 0',
              borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ color: 'var(--text-dim)' }}>✕</span>
              <span>{a.title} — {a.artist}</span>
            </div>
          ))}
        </div>
      )}

      {done && (
        <ResultCard
          correct={correct}
          answer={puzzle.answer}
          artist={puzzle.metadata?.artist}
          emojiGrid={buildEmojiGrid()}
          gameSlug="one-bar"
          nextGame={{ path: '/game/drop-or-flop', label: 'Drop or Flop' }}
        />
      )}
    </GameShell>
  )
}

function GameShell({ children }) {
  return <div className="page-shell">{children}</div>
}
