import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { getPuzzle } from '../lib/puzzles'
import { saveScore, updateStreak } from '../lib/scores'
import AudioPlayer from '../components/AudioPlayer'
import ResultCard from '../components/ResultCard'

export default function DropOrFlop() {
  const { user } = useAuth()
  const { markComplete, isComplete, completions } = useCompletion(user?.id)

  const [puzzle, setPuzzle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [chosen, setChosen] = useState(null)
  const [correct, setCorrect] = useState(false)

  useEffect(() => {
    getPuzzle('drop-or-flop')
      .then(setPuzzle)
      .catch(() => setError('No puzzle found for today.'))
      .finally(() => setLoading(false))
  }, [])

  // Restore completed state if user already played today
  useEffect(() => {
    if (!puzzle || done) return
    if (isComplete('drop-or-flop')) {
      setCorrect(completions['drop-or-flop']?.completed ?? false)
      setDone(true)
    }
  }, [puzzle, completions])

  async function handleGuess(verdict) {
    if (done) return
    const isCorrect = verdict === puzzle.metadata?.verdict
    setChosen(verdict)
    setCorrect(isCorrect)
    setDone(true)
    markComplete('drop-or-flop', 1)
    if (user) {
      await saveScore({ userId: user.id, gameSlug: 'drop-or-flop', attempts: 1, completed: isCorrect })
      if (isCorrect) await updateStreak(user.id, 'drop-or-flop')
    }
  }

  if (loading) return <GameShell><p style={{ color: 'var(--text-muted)' }}>Loading...</p></GameShell>
  if (error) return <GameShell><p style={{ color: 'var(--text-muted)' }}>{error}</p></GameShell>
  if (!puzzle) return null

  const isHit = puzzle.metadata?.verdict === 'hit'

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
          drop or flop
        </p>
        <h1 style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
          Did this song hit or miss the charts?
        </h1>
      </div>

      <AudioPlayer src={puzzle.audio_url} />

      <div style={{ marginTop: '1.25rem', marginBottom: '1.5rem' }}>
        <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          {puzzle.answer}
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {puzzle.metadata?.artist}
        </p>
      </div>

      {!done && (
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <ChoiceButton
            label="Hit"
            accent="var(--amber)"
            onClick={() => handleGuess('hit')}
          />
          <ChoiceButton
            label="Miss"
            accent="var(--border)"
            onClick={() => handleGuess('miss')}
          />
        </div>
      )}

      {done && (
        <ResultCard
          correct={correct}
          answer={correct
            ? isHit
              ? `Peak #${puzzle.metadata?.peak_position} (${puzzle.metadata?.year})`
              : `Missed the charts (${puzzle.metadata?.year})`
            : isHit
              ? `It was a hit — peaked at #${puzzle.metadata?.peak_position} in ${puzzle.metadata?.year}`
              : `It flopped — never charted (${puzzle.metadata?.year})`
          }
          detail={puzzle.metadata?.hint}
          emojiGrid={correct ? '🟩' : '⬜'}
          gameSlug="drop-or-flop"
          nextGame={{ path: '/game/who-sampled-it', label: 'Who Sampled It' }}
        />
      )}
    </GameShell>
  )
}

function ChoiceButton({ label, accent, onClick }) {
  return (
    <button
      onClick={onClick}
      className="btn-press"
      style={{
        flex: 1,
        padding: '1.25rem',
        background: 'transparent',
        border: `1px solid ${accent}`,
        borderRadius: '10px',
        color: 'var(--text-primary)',
        fontSize: '15px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'background 80ms ease',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = '#222222'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {label}
    </button>
  )
}

function GameShell({ children }) {
  return (
    <div style={{ paddingTop: '88px', paddingBottom: '4rem', maxWidth: '560px', margin: '0 auto', padding: '88px 1.25rem 4rem' }}>
      {children}
    </div>
  )
}
