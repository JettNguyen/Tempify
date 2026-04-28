import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { getPuzzle } from '../lib/puzzles'
import { saveScore, updateStreak } from '../lib/scores'
import AudioPlayer from '../components/AudioPlayer'
import ResultCard from '../components/ResultCard'

export default function WhoSampledIt() {
  const { user } = useAuth()
  const { markComplete, isComplete, completions } = useCompletion(user?.id)

  const [puzzle, setPuzzle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [chosen, setChosen] = useState(null)
  const [correct, setCorrect] = useState(false)

  useEffect(() => {
    getPuzzle('who-sampled-it')
      .then(setPuzzle)
      .catch(() => setError('No puzzle found for today.'))
      .finally(() => setLoading(false))
  }, [])

  // Restore completed state if user already played today
  useEffect(() => {
    if (!puzzle || done) return
    if (isComplete('who-sampled-it')) {
      const wasCorrect = completions['who-sampled-it']?.completed ?? false
      setChosen(wasCorrect ? puzzle.answer : null)
      setCorrect(wasCorrect)
      setDone(true)
    }
  }, [puzzle, completions])

  async function handleGuess(option) {
    if (done) return
    const isCorrect = option.title === puzzle.answer
    setChosen(option.title)
    setCorrect(isCorrect)
    setDone(true)
    markComplete('who-sampled-it', 1)
    if (user) {
      await saveScore({ userId: user.id, gameSlug: 'who-sampled-it', attempts: 1, completed: isCorrect })
      if (isCorrect) await updateStreak(user.id, 'who-sampled-it')
    }
  }

  if (loading) return <GameShell><p style={{ color: 'var(--text-muted)' }}>Loading...</p></GameShell>
  if (error) return <GameShell><p style={{ color: 'var(--text-muted)' }}>{error}</p></GameShell>
  if (!puzzle) return null

  const options = puzzle.metadata?.options || []

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
          who sampled it
        </p>
        <h1 style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
          This song samples a classic. Which one?
        </h1>
      </div>

      <div style={{ marginBottom: '0.5rem' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          {puzzle.metadata?.source_song} — {puzzle.metadata?.source_artist} ({puzzle.metadata?.source_year})
        </p>
        <AudioPlayer src={puzzle.audio_url} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.25rem' }}>
        {options.map((option) => {
          const isChosen = chosen === option.title
          const isAnswer = option.title === puzzle.answer

          let borderColor = 'var(--border)'
          if (done) {
            if (isAnswer) borderColor = 'var(--green)'
            else if (isChosen && !isAnswer) borderColor = '#ef44441a'
          }

          return (
            <button
              key={option.title}
              onClick={() => handleGuess(option)}
              disabled={done}
              className="btn-press"
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '14px 16px',
                background: 'transparent',
                border: `1px solid ${borderColor}`,
                borderRadius: '8px',
                cursor: done ? 'default' : 'pointer',
                transition: 'background 80ms ease, border-color 150ms ease',
                opacity: done && !isAnswer && !isChosen ? 0.5 : 1,
              }}
              onMouseEnter={(e) => !done && (e.currentTarget.style.background = '#222222')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>
                {option.title}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {option.artist}
              </div>
            </button>
          )
        })}
      </div>

      {done && (
        <>
          {puzzle.metadata?.sample_audio_url && (
            <div style={{ marginTop: '1.5rem' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                The original sample
              </p>
              <AudioPlayer src={puzzle.metadata.sample_audio_url} />
            </div>
          )}
          <ResultCard
            correct={correct}
            answer={puzzle.answer}
            artist={puzzle.metadata?.sample_artist}
            detail={`Originally released in ${puzzle.metadata?.sample_year}`}
            emojiGrid={correct ? '🟩' : '⬜'}
            gameSlug="who-sampled-it"
            nextGame={{ path: '/game/era', label: 'Era' }}
          />
        </>
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
