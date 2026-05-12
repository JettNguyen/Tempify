import { useState, useEffect } from 'react'
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
import DelayedSpinner from '../components/DelayedSpinner'
import './HitOrMiss.css'

export default function HitOrMiss() {
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
  const [finalTime, setFinalTime] = useState(null)

  const { stop, display } = useGameTimer(!done, 250, `tempify_game_hit-or-miss_${puzzleDate}`)

  useEffect(() => {
    getPuzzle('hit-or-miss', dateParam)
      .then(setPuzzle)
      .catch(() => setError('No puzzle found for today.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!puzzle || done) return
    if (isComplete('hit-or-miss', puzzleDate)) {
      stop()
      setCorrect(completions[`hit-or-miss|${puzzleDate}`]?.completed ?? false)
      setDone(true)
    }
  }, [puzzle, completions])

  async function handleGuess(verdict) {
    if (done) return
    hapticImportantTap()
    const elapsed = stop()
    setFinalTime(elapsed)
    const isCorrect = verdict === puzzle.metadata?.verdict
    setChosen(verdict)
    setCorrect(isCorrect)
    setDone(true)
    markComplete('hit-or-miss', puzzleDate, 1, isCorrect)
    if (user) {
      try {
        await saveScore({ userId: user.id, gameSlug: 'hit-or-miss', puzzleDate, attempts: 1, completed: isCorrect, timeSeconds: profile?.competitive_mode !== false ? elapsed : null })
        if (isCorrect) await updateStreak(user.id, 'hit-or-miss', profile?.is_subscribed)
      } catch (err) {
        console.error('[Tempify] HitOrMiss score save error:', err.message)
      }
    }
  }

  if (loading) return <GameShell><DelayedSpinner active={loading} label="Loading puzzle..." /></GameShell>
  if (error) return <GameShell><p style={{ color: 'var(--text-muted)' }}>{error}</p></GameShell>
  if (!puzzle) return null

  const isHit = puzzle.metadata?.verdict === 'hit'

  return (
    <GameShell>
      <Link to="/" className="game-back-link">← Back</Link>

      <div className="game-header">
        <p className="game-header__eyebrow">hit or miss</p>
        <h1 className="game-header__title">Did this song ever chart on the Billboard Hot 100?</h1>
        {!done && profile?.competitive_mode !== false && <p className="game-timer">{display}</p>}
      </div>

      <div className="hit-or-miss__song">
        <TrackArtwork
          title={puzzle.answer}
          artist={puzzle.metadata?.artist}
          src={puzzle.metadata?.artwork_url}
          size="medium"
        />
        <div>
          <p className="hit-or-miss__song-name">{puzzle.answer}</p>
          <p className="hit-or-miss__song-artist">{puzzle.metadata?.artist}</p>
        </div>
      </div>

      <AudioPlayer src={puzzle.audio_url} autoplay={profile?.autoplay_audio !== false} />

      <div className="stagger-list hit-or-miss__choices">
        {['hit', 'miss'].map(v => {
          const verdict = puzzle?.metadata?.verdict
          let mod = ''
          if (done) {
            if (v === verdict) mod = ' hit-or-miss__choice-btn--correct'
            else if (v === chosen) mod = ' hit-or-miss__choice-btn--wrong'
            else mod = ' hit-or-miss__choice-btn--faded'
          }
          return (
            <button
              key={v}
              onClick={() => !done && handleGuess(v)}
              disabled={done}
              className={`hit-or-miss__choice-btn btn-press${!done ? ' btn-hover' : ''}${mod}`}
            >
              {v === 'hit' ? 'Hit' : 'Miss'}
            </button>
          )
        })}
      </div>

      {done && (
        <ResultCard
          correct={correct}
          answer={correct
            ? isHit
              ? `Peak #${puzzle.metadata?.peak_position} (${puzzle.metadata?.year})`
              : `Missed the charts (${puzzle.metadata?.year})`
            : isHit
              ? `It was a hit. It peaked at #${puzzle.metadata?.peak_position} in ${puzzle.metadata?.year}`
              : `It missed. It never entered the Hot 100 (${puzzle.metadata?.year})`
          }
          detail={[puzzle.metadata?.hint, puzzle.metadata?.note].filter(Boolean).join(' · ')}
          emojiGrid={correct ? '🟩' : '⬜'}
          gameSlug="hit-or-miss"
          puzzleDate={dateParam}
          timeSeconds={finalTime}
          nextGame={{ path: '/game/sampled', label: 'Sampled' }}
          showLeaderboard={profile?.competitive_mode !== false}
        />
      )}
    </GameShell>
  )
}

function GameShell({ children }) {
  return <div className="page-shell">{children}</div>
}
