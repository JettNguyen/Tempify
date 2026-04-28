import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { getPuzzle } from '../lib/puzzles'
import { saveScore, updateStreak } from '../lib/scores'
import AudioPlayer from '../components/AudioPlayer'
import ResultCard from '../components/ResultCard'

const DECADES = ['60s', '70s', '80s', '90s', '00s', '10s', '20s']

export default function Era() {
  const { user } = useAuth()
  const { markComplete, isComplete, completions } = useCompletion(user?.id)

  const [puzzle, setPuzzle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [chosen, setChosen] = useState(null)
  const [correct, setCorrect] = useState(false)

  useEffect(() => {
    getPuzzle('era')
      .then(setPuzzle)
      .catch(() => setError('No puzzle found for today.'))
      .finally(() => setLoading(false))
  }, [])

  // Restore completed state if user already played today
  useEffect(() => {
    if (!puzzle || done) return
    if (isComplete('era')) {
      const wasCorrect = completions['era']?.completed ?? false
      setChosen(wasCorrect ? puzzle.answer : null)
      setCorrect(wasCorrect)
      setDone(true)
    }
  }, [puzzle, completions])

  async function handleGuess(decade) {
    if (done) return
    const isCorrect = decade === puzzle.answer
    setChosen(decade)
    setCorrect(isCorrect)
    setDone(true)
    markComplete('era', 1)
    if (user) {
      await saveScore({ userId: user.id, gameSlug: 'era', attempts: 1, completed: isCorrect })
      if (isCorrect) await updateStreak(user.id, 'era')
    }
  }

  if (loading) return <GameShell><p style={{ color: 'var(--text-muted)' }}>Loading...</p></GameShell>
  if (error) return <GameShell><p style={{ color: 'var(--text-muted)' }}>{error}</p></GameShell>
  if (!puzzle) return null

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
          era
        </p>
        <h1 style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
          What decade is this song from?
        </h1>
      </div>

      <AudioPlayer src={puzzle.audio_url} />

      <div style={{
        display: 'flex',
        gap: '6px',
        marginTop: '1.25rem',
        flexWrap: 'wrap',
      }}>
        {DECADES.map((decade) => {
          const isChosen = chosen === decade
          const isAnswer = decade === puzzle.answer

          let bg = 'transparent'
          let border = 'var(--border)'
          let color = 'var(--text-primary)'

          if (done) {
            if (isAnswer) {
              border = 'var(--amber)'
              color = 'var(--amber)'
            } else {
              color = 'var(--text-dim)'
              border = 'var(--border)'
            }
          }

          return (
            <button
              key={decade}
              onClick={() => handleGuess(decade)}
              disabled={done}
              className="btn-press"
              style={{
                padding: '8px 16px',
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: '999px',
                color,
                fontSize: '13px',
                fontWeight: 500,
                cursor: done ? 'default' : 'pointer',
                transition: 'background 80ms ease, color 150ms ease, border-color 150ms ease',
              }}
              onMouseEnter={(e) => !done && (e.currentTarget.style.background = '#222222')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
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
          emojiGrid={correct ? '🟩' : '⬜'}
          gameSlug="era"
          nextGame={{ path: '/game/the-flip', label: 'The Flip' }}
        />
      )}
    </GameShell>
  )
}

function GameShell({ children }) {
  return (
    <div style={{ paddingTop: '88px', paddingBottom: '4rem', maxWidth: '560px', margin: '0 auto', padding: '88px 1.25rem 4rem' }}>
      {children}
    </div>
  )
}
