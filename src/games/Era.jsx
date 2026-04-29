import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { getPuzzle } from '../lib/puzzles'
import { saveScore, updateStreak } from '../lib/scores'
import AudioPlayer from '../components/AudioPlayer'
import ResultCard from '../components/ResultCard'
import './Era.css'

const DECADES = ['60s', '70s', '80s', '90s', '00s', '10s', '20s']

export default function Era() {
  const { user } = useAuth()
  const { markComplete, isComplete, completions } = useCompletion(user?.id)
  const [searchParams] = useSearchParams()
  const dateParam = searchParams.get('date') || undefined

  const [puzzle, setPuzzle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [chosen, setChosen] = useState(null)
  const [correct, setCorrect] = useState(false)

  useEffect(() => {
    getPuzzle('era', dateParam)
      .then(setPuzzle)
      .catch(() => setError('No puzzle found for today.'))
      .finally(() => setLoading(false))
  }, [])

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
      <Link to="/" className="game-back-link">← Back</Link>

      <div className="game-header">
        <p className="game-header__eyebrow">era</p>
        <h1 className="game-header__title">What decade is this song from?</h1>
      </div>

      <AudioPlayer src={puzzle.audio_url} />

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
            <button
              key={decade}
              onClick={() => handleGuess(decade)}
              disabled={done}
              className={cls}
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
          nextGame={{ path: '/game/cover-or-not', label: 'Cover or Not' }}
        />
      )}
    </GameShell>
  )
}

function GameShell({ children }) {
  return <div className="page-shell">{children}</div>
}
