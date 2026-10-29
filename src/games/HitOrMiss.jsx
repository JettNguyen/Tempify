import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { useGameTimer } from '../hooks/useGameTimer'
import { todayEST, fmtDayShort } from '../lib/date'
import { exitTarget } from '../lib/gameExit'
import { getPuzzle, getCachedPuzzle } from '../lib/puzzles'
import { saveScore, updateStreak } from '../lib/scores'
import { hapticImportantTap } from '../lib/haptics'
import { lockInDelay } from '../lib/lockIn'
import AudioPlayer from '../components/AudioPlayer'
import GameHeader from '../components/GameHeader'
import StageSong from '../components/StageSong'
import ResultCard from '../components/ResultCard'
import Icon from '../components/Icon'
import DelayedSpinner from '../components/DelayedSpinner'
import './choices.css'
import './HitOrMiss.css'

// Each answer drawn as a little chart against the Hot 100 line: a hit's bars
// climb through it, a miss's never reach it.
function HitArt(props) {
  return (
    <svg viewBox="0 0 52 30" fill="currentColor" aria-hidden="true" {...props}>
      <line x1="0" y1="10" x2="52" y2="10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.5" />
      {[9, 15, 22, 29].map((h, i) => (
        <rect key={i} className="hit-or-miss__art-bar" style={{ '--n': i }} x={2 + i * 13} y={30 - h} width="9" height={h} rx="2" />
      ))}
    </svg>
  )
}

function MissArt(props) {
  return (
    <svg viewBox="0 0 52 30" fill="currentColor" aria-hidden="true" {...props}>
      <line x1="0" y1="10" x2="52" y2="10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.5" />
      {[12, 7, 15, 9].map((h, i) => (
        <rect key={i} className="hit-or-miss__art-bar" style={{ '--n': i }} x={2 + i * 13} y={30 - h} width="9" height={h} rx="2" />
      ))}
    </svg>
  )
}

const CHOICES = [
  { value: 'hit', label: 'Hit', sub: 'Made the Hot 100', Art: HitArt },
  { value: 'miss', label: 'Miss', sub: 'Never charted', Art: MissArt },
]

export default function HitOrMiss() {
  const { user, profile } = useAuth()
  const { markComplete, isComplete, completions } = useCompletion(user?.id)
  const [searchParams] = useSearchParams()
  const dateParam = searchParams.get('date') || undefined
  const puzzleDate = dateParam || todayEST()

  // Seeded from the session cache the home screen warmed, so a tapped tile
  // paints the real screen immediately instead of an empty shell.
  const cachedPuzzle = getCachedPuzzle('hit-or-miss', dateParam)
  const [puzzle, setPuzzle] = useState(cachedPuzzle)
  const [loading, setLoading] = useState(!cachedPuzzle)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [justFinished, setJustFinished] = useState(false)
  const [chosen, setChosen] = useState(null)
  const [correct, setCorrect] = useState(false)
  const [finalTime, setFinalTime] = useState(null)
  const revealRef = useRef(0)

  const { stop, display } = useGameTimer(!done, 250, `tempify_game_hit-or-miss_${puzzleDate}`)

  useEffect(() => {
    // Already seeded from cache, since refetching would only re-run derived
    // state (option order) and make the screen jump.
    if (cachedPuzzle) return
    getPuzzle('hit-or-miss', dateParam)
      .then(setPuzzle)
      .catch(() => setError('No puzzle found for today.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    // A pick still in its beat reveals itself when the beat is over.
    if (!puzzle || done || chosen) return
    if (isComplete('hit-or-miss', puzzleDate)) {
      stop()
      setCorrect(completions[`hit-or-miss|${puzzleDate}`]?.completed ?? false)
      setDone(true)
    }
  }, [puzzle, completions])

  useEffect(() => () => clearTimeout(revealRef.current), [])

  async function handleGuess(verdict) {
    if (done || chosen) return
    hapticImportantTap()
    const elapsed = stop()
    setFinalTime(elapsed)
    const isCorrect = verdict === puzzle.metadata?.verdict
    setChosen(verdict)
    setCorrect(isCorrect)
    // Recorded at the tap rather than after the beat, so leaving during it
    // can't lose the answer.
    markComplete('hit-or-miss', puzzleDate, 1, isCorrect)
    revealRef.current = setTimeout(() => {
      setDone(true)
      setJustFinished(true)
    }, lockInDelay())
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
  const verdict = puzzle.metadata?.verdict

  return (
    <GameShell>
      <Link to={exitTarget(searchParams)} replace className="game-back-link tap-target"><Icon name="chevronLeft" size={14} />Back</Link>

      <GameHeader
        slug="hit-or-miss"
        name="hit or miss"
        date={fmtDayShort(puzzleDate)}
        title="Did this song ever chart on the Billboard Hot 100?"
        timer={!done && profile?.competitive_mode !== false ? { text: display, running: !chosen } : null}
      />

      <AudioPlayer variant="stage" visual="chart" src={puzzle.audio_url} autoplay={profile?.autoplay_audio !== false}>
        <StageSong title={puzzle.answer} artist={puzzle.metadata?.artist} src={puzzle.metadata?.artwork_url} />
      </AudioPlayer>

      <div className="choices">
        {CHOICES.map(({ value, label, sub, Art }, i) => {
          let mod = ''
          let mark = null
          if (done) {
            if (value === verdict) { mod = ' choice--correct'; mark = 'check' }
            else if (value === chosen) { mod = ' choice--wrong'; mark = 'x' }
            else mod = ' choice--faded'
          } else if (chosen) {
            mod = value === chosen ? ' choice--locked' : ' choice--waiting'
          }
          return (
            <button
              key={value}
              type="button"
              onClick={() => handleGuess(value)}
              disabled={done || Boolean(chosen)}
              className={`choice${mod}`}
              style={{ '--i': i }}
            >
              <Art className="choice__art" />
              <span>
                <span className="choice__label">{label}</span>
                <span className="choice__sub">{sub}</span>
              </span>
              {mark && (
                <span className="choice__mark">
                  <Icon name={mark} size={14} strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {done && (
        <ResultCard
          justFinished={justFinished}
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
          gameSlug="hit-or-miss"
          puzzleDate={dateParam}
          timeSeconds={profile?.competitive_mode !== false ? finalTime : null}
          nextGame={{ path: '/game/era', label: 'Era' }}
          showLeaderboard={profile?.competitive_mode !== false}
        />
      )}
    </GameShell>
  )
}

function GameShell({ children }) {
  return <div className="page-shell page-shell--fill game-theme--hit-or-miss">{children}</div>
}
