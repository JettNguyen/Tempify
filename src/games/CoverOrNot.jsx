import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { useGameTimer } from '../hooks/useGameTimer'
import { todayEST } from '../lib/date'
import { getPuzzle } from '../lib/puzzles'
import { saveScore, updateStreak } from '../lib/scores'
import AudioPlayer from '../components/AudioPlayer'
import ResultCard from '../components/ResultCard'
import TrackArtwork from '../components/TrackArtwork'
import './CoverOrNot.css'

export default function CoverOrNot() {
  const { user, profile } = useAuth()
  const { markComplete, isComplete, completions } = useCompletion(user?.id)
  const [searchParams] = useSearchParams()
  const dateParam = searchParams.get('date') || undefined
  const puzzleDate = dateParam || todayEST()

  const [puzzle, setPuzzle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [finalTime, setFinalTime] = useState(null)
  const coverRef = useRef(null)
  const originalRef = useRef(null)

  const { stop, display } = useGameTimer(!done, 250, `tempify_game_cover-or-not_${puzzleDate}`)

  useEffect(() => {
    getPuzzle('cover-or-not', dateParam)
      .then(setPuzzle)
      .catch(() => setError('No puzzle found for today.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!puzzle || done) return
    if (isComplete('cover-or-not')) {
      stop()
      setCorrect(completions['cover-or-not']?.completed ?? false)
      setDone(true)
    }
  }, [puzzle, completions])

  async function handleGuess(pick) {
    if (done) return
    const elapsed = stop()
    setFinalTime(elapsed)
    const isCorrect = pick === puzzle.answer
    setCorrect(isCorrect)
    setDone(true)
    if (puzzle.answer === 'cover' && puzzle.metadata?.original_audio_url) {
      coverRef.current?.pause()
    }
    markComplete('cover-or-not', 1)
    if (user) {
      await saveScore({ userId: user.id, gameSlug: 'cover-or-not', attempts: 1, completed: isCorrect, timeSeconds: elapsed })
      if (isCorrect) await updateStreak(user.id, 'cover-or-not', profile?.is_subscribed)
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
        {!done && <p className="game-timer">{display}</p>}
      </div>

      <div className="cover-or-not__song">
        <div className="cover-or-not__song-track">
          <TrackArtwork
            title={m.song_title}
            artist={m.song_artist}
            src={m.artwork_url || m.song_artwork_url}
            size="medium"
          />
          {m.song_title && (
            <div>
              <p className="cover-or-not__song-name">{m.song_title}</p>
              {m.song_artist && (
                <p className="cover-or-not__song-meta">
                  {m.song_artist}{m.song_year ? ` · ${m.song_year}` : ''}
                </p>
              )}
            </div>
          )}
        </div>
        <AudioPlayer ref={coverRef} src={puzzle.audio_url} onPlay={() => originalRef.current?.pause()} />
      </div>

      {!done && (
        <div className="stagger-list cover-or-not__choices">
          <ChoiceButton label="It's a cover" onClick={() => handleGuess('cover')} />
          <ChoiceButton label="It's original" onClick={() => handleGuess('original')} />
        </div>
      )}

      {done && (
        <ResultCard
          correct={correct}
          answer={isCover
            ? `It's a cover${m.original_title ? ` of "${m.original_title}"` : ''}${m.original_artist ? ` by ${m.original_artist}` : ''}`
            : "It's an original"
          }
          artwork={isCover ? {
            title: m.original_title,
            artist: m.original_artist,
            src: m.original_artwork_url,
          } : undefined}
          emojiGrid={correct ? '🟩' : '⬜'}
          gameSlug="cover-or-not"
          puzzleDate={dateParam}
          timeSeconds={finalTime}
          nextGame={{ path: '/', label: 'Back to games' }}
        >
          {isCover && (
            <div className="cover-or-not__original-reveal">
              <p className="cover-or-not__original-label">The original</p>
              {m.original_title && <p className="cover-or-not__original-name">{m.original_title}</p>}
              {m.original_artist && (
                <p className="cover-or-not__original-meta">
                  {m.original_artist}{m.original_year ? ` · ${m.original_year}` : ''}
                </p>
              )}
              {m.original_audio_url && (
                <AudioPlayer ref={originalRef} src={m.original_audio_url} onPlay={() => coverRef.current?.pause()} />
              )}
            </div>
          )}
        </ResultCard>
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
