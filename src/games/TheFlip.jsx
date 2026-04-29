import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { getPuzzle } from '../lib/puzzles'
import { saveScore, updateStreak } from '../lib/scores'
import AudioPlayer from '../components/AudioPlayer'
import ResultCard from '../components/ResultCard'

export default function TheFlip() {
  const { user } = useAuth()
  const { markComplete, isComplete, completions } = useCompletion(user?.id)

  const [puzzle, setPuzzle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [chosen, setChosen] = useState(null)
  const [correct, setCorrect] = useState(false)
  const refA = useRef(null)
  const refB = useRef(null)

  useEffect(() => {
    getPuzzle('the-flip')
      .then(setPuzzle)
      .catch(() => setError('No puzzle found for today.'))
      .finally(() => setLoading(false))
  }, [])

  // Restore completed state if user already played today
  useEffect(() => {
    if (!puzzle || done) return
    if (isComplete('the-flip')) {
      setCorrect(completions['the-flip']?.completed ?? false)
      setDone(true)
    }
  }, [puzzle, completions])

  async function handleGuess(pick) {
    if (done) return
    const isCorrect = pick === puzzle.answer
    setChosen(pick)
    setCorrect(isCorrect)
    setDone(true)
    markComplete('the-flip', 1)
    if (user) {
      await saveScore({ userId: user.id, gameSlug: 'the-flip', attempts: 1, completed: isCorrect })
      if (isCorrect) await updateStreak(user.id, 'the-flip')
    }
  }

  if (loading) return <GameShell><p style={{ color: 'var(--text-muted)' }}>Loading...</p></GameShell>
  if (error) return <GameShell><p style={{ color: 'var(--text-muted)' }}>{error}</p></GameShell>
  if (!puzzle) return null

  const vA = puzzle.metadata?.version_a
  const vB = puzzle.metadata?.version_b

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
          the flip
        </p>
        <h1 style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
          Which version came first?
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Version A</p>
          <AudioPlayer ref={refA} src={vA?.audio_url} label={null} onPlay={() => refB.current?.pause()} />
        </div>
        <div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Version B</p>
          <AudioPlayer ref={refB} src={vB?.audio_url} label={null} onPlay={() => refA.current?.pause()} />
        </div>
      </div>

      {!done && (
        <div className="stagger-list" style={{ display: 'flex', gap: '0.75rem' }}>
          <ChoiceButton label="A came first" onClick={() => handleGuess('A')} />
          <ChoiceButton label="B came first" onClick={() => handleGuess('B')} />
        </div>
      )}

      {done && (
        <>
          {/* Timeline visual */}
          <div style={{
            marginTop: '1rem',
            padding: '1.25rem 1.5rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
          }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              The timeline
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0', position: 'relative' }}>
              <TimelineNode
                label={vA?.year < vB?.year ? vA?.year : vB?.year}
                version={vA?.year < vB?.year ? 'A' : 'B'}
                title={vA?.year < vB?.year ? vA?.title : vB?.title}
                isAnswer={puzzle.answer === (vA?.year < vB?.year ? 'A' : 'B')}
              />
              <div style={{
                flex: 1,
                height: '1px',
                background: 'var(--border)',
                margin: '0 -1px',
                position: 'relative',
                top: '-10px',
              }} />
              <TimelineNode
                label={vA?.year > vB?.year ? vA?.year : vB?.year}
                version={vA?.year > vB?.year ? 'A' : 'B'}
                title={vA?.year > vB?.year ? vA?.title : vB?.title}
                isAnswer={false}
              />
            </div>
          </div>

          <ResultCard
            correct={correct}
            answer={`Version ${puzzle.answer} came first (${puzzle.answer === 'A' ? vA?.year : vB?.year})`}
            emojiGrid={correct ? '🟩' : '⬜'}
            gameSlug="the-flip"
            nextGame={{ path: '/', label: 'Back to games' }}
          />
        </>
      )}
    </GameShell>
  )
}

function TimelineNode({ label, version, title, isAnswer }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        background: isAnswer ? 'var(--amber-glow)' : 'var(--surface)',
        border: `1px solid ${isAnswer ? 'var(--amber)' : 'var(--border)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11px',
        fontWeight: 500,
        color: isAnswer ? 'var(--amber)' : 'var(--text-muted)',
      }}>
        {version}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '80px' }}>{title}</div>
      </div>
    </div>
  )
}

function ChoiceButton({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="btn-press btn-hover"
      style={{
        flex: 1,
        padding: '1rem',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        color: 'var(--text-primary)',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function GameShell({ children }) {
  return <div className="page-shell">{children}</div>
}
