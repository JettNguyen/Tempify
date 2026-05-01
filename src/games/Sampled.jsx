import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { useGameTimer } from '../hooks/useGameTimer'
import { todayEST } from '../lib/date'
import { getPuzzle } from '../lib/puzzles'
import { saveScore, updateStreak } from '../lib/scores'
import { hapticImportantTap } from '../lib/haptics'
import AudioPlayer from '../components/AudioPlayer'
import ResultCard from '../components/ResultCard'
import TrackArtwork from '../components/TrackArtwork'
import './Sampled.css'

export default function Sampled() {
  const { user, profile } = useAuth()
  const { markComplete, isComplete, completions } = useCompletion(user?.id)
  const [searchParams] = useSearchParams()
  const dateParam = searchParams.get('date') || undefined
  const puzzleDate = dateParam || todayEST()

  const [puzzle, setPuzzle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [chosen, setChosen] = useState(null)
  const [correct, setCorrect] = useState(false)
  const [shuffledOptions, setShuffledOptions] = useState([])
  const [finalTime, setFinalTime] = useState(null)
  const [shouldAutoplaySample, setShouldAutoplaySample] = useState(false)
  const sourceRef = useRef(null)
  const sampleRef = useRef(null)

  const { stop, display } = useGameTimer(!done, 250, `tempify_game_sampled_${puzzleDate}`)

  useEffect(() => {
    getPuzzle('sampled', dateParam)
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
    if (isComplete('sampled')) {
      stop()
      const wasCorrect = completions['sampled']?.completed ?? false
      setChosen(wasCorrect ? puzzle.answer : null)
      setCorrect(wasCorrect)
      setShouldAutoplaySample(false)
      setDone(true)
    }
  }, [puzzle, completions])

  useEffect(() => {
    if (!done || !shouldAutoplaySample) return
    sampleRef.current?.play()
    setShouldAutoplaySample(false)
  }, [done, shouldAutoplaySample])

  async function handleGuess(option) {
    if (done) return
    hapticImportantTap()
    sourceRef.current?.pause()
    const elapsed = stop()
    setFinalTime(elapsed)
    const isCorrect = option.title === puzzle.answer
    setChosen(option.title)
    setCorrect(isCorrect)
    setDone(true)
    setShouldAutoplaySample(Boolean(puzzle.metadata?.sample_audio_url))
    markComplete('sampled', 1, isCorrect)
    if (user) {
      await saveScore({ userId: user.id, gameSlug: 'sampled', attempts: 1, completed: isCorrect, timeSeconds: elapsed })
      if (isCorrect) await updateStreak(user.id, 'sampled', profile?.is_subscribed)
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

      <div className="sampled__source">
        <div className="sampled__source-track">
          <TrackArtwork
            title={puzzle.metadata?.source_song}
            artist={puzzle.metadata?.source_artist}
            src={puzzle.metadata?.source_artwork_url}
            size="medium"
          />
          <div>
            <p className="sampled__source-title">{puzzle.metadata?.source_song}</p>
            <p className="sampled__source-label">
              {puzzle.metadata?.source_artist} ({puzzle.metadata?.source_year})
            </p>
          </div>
        </div>
        <AudioPlayer ref={sourceRef} src={puzzle.audio_url} />
      </div>

      <div className="stagger-list sampled__options">
        {shuffledOptions.map((option) => {
          const isChosen = chosen === option.title
          const isAnswer = option.title === puzzle.answer

          let optionClass = 'sampled__option btn-press'
          if (done) {
            if (isAnswer) optionClass += ' sampled__option--answer'
            else if (isChosen) optionClass += ' sampled__option--wrong'
            else optionClass += ' sampled__option--faded'
          } else {
            optionClass += ' btn-hover'
          }

          return (
            <button key={option.title} onClick={() => handleGuess(option)} disabled={done} className={optionClass}>
              <TrackArtwork title={option.title} artist={option.artist} src={option.artwork_url} size="small" />
              <div>
                <div className="sampled__option-title">{option.title}</div>
                <div className="sampled__option-artist">{option.artist}</div>
              </div>
            </button>
          )
        })}
      </div>

      {done && (
        <>
          {puzzle.metadata?.sample_audio_url && (
            <div className="sampled__original">
              <p className="sampled__original-label">The original sample</p>
              <AudioPlayer ref={sampleRef} src={puzzle.metadata.sample_audio_url} />
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
            gameSlug="sampled"
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
