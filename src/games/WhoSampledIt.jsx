import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { useGameTimer } from '../hooks/useGameTimer'
import { getPuzzle } from '../lib/puzzles'
import { saveScore, updateStreak } from '../lib/scores'
import AudioPlayer from '../components/AudioPlayer'
import ResultCard from '../components/ResultCard'
import TrackArtwork from '../components/TrackArtwork'
import './WhoSampledIt.css'

export default function WhoSampledIt() {
  const { user, profile } = useAuth()
  const { markComplete, isComplete, completions } = useCompletion(user?.id)
  const [searchParams] = useSearchParams()
  const dateParam = searchParams.get('date') || undefined

  const [puzzle, setPuzzle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [chosen, setChosen] = useState(null)
  const [correct, setCorrect] = useState(false)
  const [shuffledOptions, setShuffledOptions] = useState([])
  const [finalTime, setFinalTime] = useState(null)
  const sourceRef = useRef(null)

  const { stop, display } = useGameTimer(!done)

  useEffect(() => {
    getPuzzle('who-sampled-it', dateParam)
      .then(p => {
        setPuzzle(p)
        const opts = p?.metadata?.options || []
        setShuffledOptions([...opts].sort(() => Math.random() - 0.5))
      })
      .catch(() => setError('No puzzle found for today.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!puzzle || done) return
    if (isComplete('who-sampled-it')) {
      stop()
      const wasCorrect = completions['who-sampled-it']?.completed ?? false
      setChosen(wasCorrect ? puzzle.answer : null)
      setCorrect(wasCorrect)
      setDone(true)
    }
  }, [puzzle, completions])

  async function handleGuess(option) {
    if (done) return
    sourceRef.current?.pause()
    const elapsed = stop()
    setFinalTime(elapsed)
    const isCorrect = option.title === puzzle.answer
    setChosen(option.title)
    setCorrect(isCorrect)
    setDone(true)
    markComplete('who-sampled-it', 1)
    if (user) {
      await saveScore({ userId: user.id, gameSlug: 'who-sampled-it', attempts: 1, completed: isCorrect, timeSeconds: elapsed })
      if (isCorrect) await updateStreak(user.id, 'who-sampled-it', profile?.is_subscribed)
    }
  }

  if (loading) return <GameShell><p style={{ color: 'var(--text-muted)' }}>Loading...</p></GameShell>
  if (error) return <GameShell><p style={{ color: 'var(--text-muted)' }}>{error}</p></GameShell>
  if (!puzzle) return null

  return (
    <GameShell>
      <Link to="/" className="game-back-link">← Back</Link>

      <div className="game-header">
        <p className="game-header__eyebrow">sampled</p>
        <h1 className="game-header__title">This song samples a classic. Which one?</h1>
        {!done && <p className="game-timer">{display}</p>}
      </div>

      <div className="who-sampled__source">
        <div className="who-sampled__source-track">
          <TrackArtwork
            title={puzzle.metadata?.source_song}
            artist={puzzle.metadata?.source_artist}
            src={puzzle.metadata?.source_artwork_url}
            size="medium"
          />
          <div>
            <p className="who-sampled__source-title">{puzzle.metadata?.source_song}</p>
            <p className="who-sampled__source-label">
              {puzzle.metadata?.source_artist} ({puzzle.metadata?.source_year})
            </p>
          </div>
        </div>
        <AudioPlayer ref={sourceRef} src={puzzle.audio_url} />
      </div>

      <div className="stagger-list who-sampled__options">
        {shuffledOptions.map((option) => {
          const isChosen = chosen === option.title
          const isAnswer = option.title === puzzle.answer

          let optionClass = 'who-sampled__option btn-press'
          if (done) {
            if (isAnswer) optionClass += ' who-sampled__option--answer'
            else if (isChosen) optionClass += ' who-sampled__option--wrong'
            else optionClass += ' who-sampled__option--faded'
          } else {
            optionClass += ' btn-hover'
          }

          return (
            <button key={option.title} onClick={() => handleGuess(option)} disabled={done} className={optionClass}>
              <TrackArtwork title={option.title} artist={option.artist} src={option.artwork_url} size="small" />
              <div>
                <div className="who-sampled__option-title">{option.title}</div>
                <div className="who-sampled__option-artist">{option.artist}</div>
              </div>
            </button>
          )
        })}
      </div>

      {done && (
        <>
          {puzzle.metadata?.sample_audio_url && (
            <div className="who-sampled__original">
              <p className="who-sampled__original-label">The original sample</p>
              <AudioPlayer src={puzzle.metadata.sample_audio_url} />
            </div>
          )}
          <ResultCard
            correct={correct}
            answer={puzzle.answer}
            artist={puzzle.metadata?.sample_artist}
            artwork={{
              title: puzzle.answer,
              artist: puzzle.metadata?.sample_artist,
              src: puzzle.metadata?.sample_artwork_url,
            }}
            detail={`Originally released in ${puzzle.metadata?.sample_year}`}
            emojiGrid={correct ? '🟩' : '⬜'}
            gameSlug="who-sampled-it"
            puzzleDate={dateParam}
            timeSeconds={finalTime}
            nextGame={{ path: '/game/era', label: 'Era' }}
          />
        </>
      )}
    </GameShell>
  )
}

function GameShell({ children }) {
  return <div className="page-shell">{children}</div>
}
