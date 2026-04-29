import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { getPuzzle } from '../lib/puzzles'
import { saveScore, updateStreak } from '../lib/scores'
import AudioPlayer from '../components/AudioPlayer'
import ResultCard from '../components/ResultCard'
import './CoverOrNot.css'

export default function CoverOrNot() {
  const { user } = useAuth()
  const { markComplete, isComplete, completions } = useCompletion(user?.id)

  const [puzzle, setPuzzle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [correct, setCorrect] = useState(false)
  const coverRef = useRef(null)
  const originalRef = useRef(null)

  useEffect(() => {
    getPuzzle('cover-or-not')
      .then(setPuzzle)
      .catch(() => setError('No puzzle found for today.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!puzzle || done) return
    if (isComplete('cover-or-not')) {
      setCorrect(completions['cover-or-not']?.completed ?? false)
      setDone(true)
    }
  }, [puzzle, completions])

  async function handleGuess(pick) {
    if (done) return
    const isCorrect = pick === puzzle.answer
    setCorrect(isCorrect)
    setDone(true)
    markComplete('cover-or-not', 1)
    if (user) {
      await saveScore({ userId: user.id, gameSlug: 'cover-or-not', attempts: 1, completed: isCorrect })
      if (isCorrect) await updateStreak(user.id, 'cover-or-not')
    }
  }

  if (loading) return <GameShell><p style={{ color: 'var(--text-muted)' }}>Loading...</p></GameShell>
  if (error) return <GameShell><p style={{ color: 'var(--text-muted)' }}>{error}</p></GameShell>
  if (!puzzle) return null

  const m = puzzle.metadata || {}
  const isCover = puzzle.answer === 'cover'

  return (
    <GameShell>
      <Link to="/" className="game-back-link">← Back</Link>

      <div className="game-header">
        <p className="game-header__eyebrow">cover or not</p>
        <h1 className="game-header__title">Is this song a cover of an earlier track?</h1>
      </div>

      <div className="cover-or-not__song">
        {m.song_title && (
          <>
            <p className="cover-or-not__song-name">{m.song_title}</p>
            {m.song_artist && (
              <p className="cover-or-not__song-meta">
                {m.song_artist}{m.song_year ? ` · ${m.song_year}` : ''}
              </p>
            )}
          </>
        )}
        <AudioPlayer
          ref={coverRef}
          src={puzzle.audio_url}
          onPlay={() => originalRef.current?.pause()}
        />
      </div>

      {!done && (
        <div className="stagger-list cover-or-not__choices">
          <ChoiceButton label="It's a cover" onClick={() => handleGuess('cover')} />
          <ChoiceButton label="It's original" onClick={() => handleGuess('original')} />
        </div>
      )}

      {done && (
        <>
          {isCover && m.original_audio_url && (
            <div className="cover-or-not__original-card">
              <p className="cover-or-not__original-label">The original</p>
              <p className="cover-or-not__original-name">{m.original_title}</p>
              {m.original_artist && (
                <p className="cover-or-not__original-meta">
                  {m.original_artist}{m.original_year ? ` · ${m.original_year}` : ''}
                </p>
              )}
              <AudioPlayer
                ref={originalRef}
                src={m.original_audio_url}
                onPlay={() => coverRef.current?.pause()}
              />
            </div>
          )}

          {isCover && !m.original_audio_url && m.original_title && (
            <div className="cover-or-not__original-card">
              <p className="cover-or-not__original-label">The original</p>
              <p className="cover-or-not__original-name">{m.original_title}</p>
              {m.original_artist && (
                <p className="cover-or-not__original-meta">
                  {m.original_artist}{m.original_year ? ` · ${m.original_year}` : ''}
                </p>
              )}
            </div>
          )}

          <ResultCard
            correct={correct}
            answer={isCover
              ? `It's a cover${m.original_title ? ` of "${m.original_title}"` : ''}${m.original_artist ? ` by ${m.original_artist}` : ''}`
              : "It's an original"
            }
            emojiGrid={correct ? '🟩' : '⬜'}
            gameSlug="cover-or-not"
            nextGame={{ path: '/', label: 'Back to games' }}
          />
        </>
      )}
    </GameShell>
  )
}

function ChoiceButton({ label, onClick }) {
  return (
    <button onClick={onClick} className="cover-or-not__choice-btn btn-press btn-hover">
      {label}
    </button>
  )
}

function GameShell({ children }) {
  return <div className="page-shell">{children}</div>
}
