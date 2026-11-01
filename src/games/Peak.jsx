import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { useGameTimer } from '../hooks/useGameTimer'
import { fmtDayShort } from '../lib/date'
import { exitTarget } from '../lib/gameExit'
import { saveScore, updateStreak } from '../lib/scores'
import { prefetchClip } from '../lib/audioEngine'
import { hapticImportantTap, hapticSelection } from '../lib/haptics'
import { lockInDelay } from '../lib/lockIn'
import { NEVER_FROM, dialAt, peakAt, peakPoints, peakLabel } from '../lib/peak'
import { ROUND_MAX, isWin, fmtPoints, roundTier, shareSquares, loadRounds, saveRounds } from '../lib/points'
import AudioPlayer from '../components/AudioPlayer'
import GameHeader from '../components/GameHeader'
import StageSong from '../components/StageSong'
import ResultCard from '../components/ResultCard'
import Icon from '../components/Icon'
import './Peak.css'

const SLUG = 'hit-or-miss'

// The thumb starts in the middle of the charted stretch, so no first guess is
// pulled toward either end.
const START_AT = NEVER_FROM / 2

// The top ten take up as much of the dial as #40 to #100, so the marks
// crowd the top. #100 goes unmarked: it sits right against "Never".
const TICKS = [1, 10, 25, 50]

function weeksText(n, what) {
  return `${n} week${n === 1 ? '' : 's'} ${what}`
}

function verdictText(round) {
  if (!round.peak) return 'It never made the Hot 100'
  const parts = [`Peaked at #${round.peak}`]
  if (round.weeks_at_one) parts.push(weeksText(round.weeks_at_one, 'at #1'))
  else if (round.weeks_on_chart) parts.push(weeksText(round.weeks_on_chart, 'on the chart'))
  return parts.join(' · ')
}

/**
 * Hit or Miss, five songs at a time, as a dial: drag to where each one peaked
 * on the Hot 100, or past #100 to say it never charted. Each lock-in shows how
 * far off it was and pays up to 1,000 for being close.
 */
export default function Peak({ puzzle, puzzleDate, dateParam, Shell }) {
  const { user, profile } = useAuth()
  const { markComplete, isComplete, completions } = useCompletion(user?.id)
  const [searchParams] = useSearchParams()
  const rounds = puzzle.metadata.rounds
  const maxPoints = rounds.length * ROUND_MAX
  const competitive = profile?.competitive_mode !== false

  const [results, setResults] = useState(() => loadRounds(SLUG, puzzleDate).slice(0, rounds.length))
  // A round stays on screen with its answer until "Next song", so the one
  // showing can be one behind the next one to play.
  const [index, setIndex] = useState(() => Math.min(results.length, rounds.length - 1))
  const [position, setPosition] = useState(START_AT)
  const [locking, setLocking] = useState(false)
  const [done, setDone] = useState(false)
  const [justFinished, setJustFinished] = useState(false)
  const [finalTime, setFinalTime] = useState(null)
  const revealRef = useRef(0)
  // Set by the first lock-in here, so the completion arriving from our own
  // last round doesn't skip straight past its reveal.
  const playedRef = useRef(false)

  const { stop, display } = useGameTimer(!done, 250, `tempify_game_${SLUG}_${puzzleDate}`)

  useEffect(() => {
    rounds.forEach((r) => prefetchClip(r.audio_url))
  }, [rounds])

  useEffect(() => {
    if (done || playedRef.current) return
    if (isComplete(SLUG, puzzleDate) || results.length >= rounds.length) {
      stop()
      setDone(true)
    }
  }, [completions])

  useEffect(() => () => clearTimeout(revealRef.current), [])

  const round = rounds[index]
  const result = results[index]
  const revealed = Boolean(result)
  const total = results.reduce((sum, r) => sum + (r.points || 0), 0)
  // Someone who finished on another device has a score but no rounds here.
  const savedPoints = completions[`${SLUG}|${puzzleDate}`]?.points
  const finalPoints = results.length === rounds.length ? total : (savedPoints ?? total)
  const guess = revealed ? result.guess : peakAt(position)

  function move(e) {
    const next = Number(e.target.value) / 1000
    const before = peakAt(position)
    const after = peakAt(next)
    // A tick at the two ends rather than every place: a buzz per number would
    // be a buzz storm on one swipe.
    if (after !== before && (after === 0 || after === 1)) hapticSelection()
    setPosition(next)
  }

  async function finish(all, elapsed) {
    const points = all.reduce((sum, r) => sum + r.points, 0)
    const won = isWin(points, maxPoints)
    markComplete(SLUG, puzzleDate, 1, won, points)
    if (!user) return
    try {
      await saveScore({ userId: user.id, gameSlug: SLUG, puzzleDate, attempts: 1, completed: won, timeSeconds: competitive ? elapsed : null, points })
      if (won) await updateStreak(user.id, SLUG, profile?.is_subscribed)
    } catch (err) {
      console.error('[Tempify] Peak score save error:', err.message)
    }
  }

  function lockIn() {
    if (locking || revealed || done) return
    hapticImportantTap()
    playedRef.current = true
    const points = peakPoints(guess, round.peak || 0)
    const all = [...results, { guess, points }]
    // Written at the tap rather than after the beat, so leaving during it
    // can't hand the same song back with its answer already seen.
    saveRounds(SLUG, puzzleDate, all)
    if (all.length === rounds.length) {
      const elapsed = stop()
      setFinalTime(elapsed)
      finish(all, elapsed)
    }
    setLocking(true)
    revealRef.current = setTimeout(() => {
      revealRef.current = 0
      setLocking(false)
      setResults(all)
    }, lockInDelay())
  }

  function advance() {
    hapticSelection()
    if (index < rounds.length - 1) {
      setIndex(index + 1)
      setPosition(START_AT)
    } else {
      setDone(true)
      setJustFinished(true)
    }
  }

  const tier = revealed ? roundTier(result.points) : null
  const isLast = index === rounds.length - 1
  const squares = results.length === rounds.length ? shareSquares(results.map(r => r.points)) : null
  // The round that went best, for the line under the score.
  const best = results.length === rounds.length
    ? results.reduce((b, r, i) => (r.points > results[b].points ? i : b), 0)
    : null

  return (
    <Shell className="peak">
      <Link to={exitTarget(searchParams)} replace className="game-back-link tap-target"><Icon name="chevronLeft" size={14} />Back</Link>

      <GameHeader
        slug={SLUG}
        name="hit or miss"
        date={fmtDayShort(puzzleDate)}
        title="How high did it chart?"
        timer={!done && competitive ? { text: display, running: !locking && !revealed } : null}
      />

      <div className="peak__progress">
        <span className="peak__pips" aria-label={`Song ${index + 1} of ${rounds.length}`}>
          {rounds.map((_, i) => {
            const r = results[i]
            const state = r ? roundTier(r.points) : i === index && !done ? 'now' : 'todo'
            return <span key={i} className={`peak__pip peak__pip--${state}`} />
          })}
        </span>
        <span className="peak__total">{fmtPoints(done ? finalPoints : total)} pts</span>
      </div>

      <AudioPlayer
        key={index}
        variant="stage"
        visual="chart"
        src={round.audio_url}
        autoplay={!done && profile?.autoplay_audio !== false}
      >
        <StageSong title={round.title} artist={round.artist} src={round.artwork_url} />
      </AudioPlayer>

      {done ? (
        <ol className="peak__summary">
          {rounds.map((r, i) => {
            const mine = results[i]
            return (
              <li key={i}>
                <button
                  type="button"
                  className={`peak__summary-row btn-press${i === index ? ' peak__summary-row--on' : ''}`}
                  onClick={() => { hapticSelection(); setIndex(i) }}
                  aria-label={`Play ${r.title}`}
                >
                  <span className="peak__summary-song">
                    <span className="peak__summary-title">{r.title}</span>
                    <span className="peak__summary-artist">{r.artist}</span>
                  </span>
                  <span className="peak__summary-call">
                    {mine && <span className="peak__summary-guess">You said {mine.guess ? `#${mine.guess}` : 'never'}</span>}
                    <span className="peak__summary-peak">{r.peak ? `Peak #${r.peak}` : 'Never charted'}</span>
                  </span>
                  {mine && (
                    <span className={`peak__summary-points peak__summary-points--${roundTier(mine.points)}`}>
                      {fmtPoints(mine.points)}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ol>
      ) : (
        <div
          className={`peak-dial${revealed ? ` peak-dial--revealed peak-dial--${tier}` : ''}${locking ? ' peak-dial--locking' : ''}`}
          style={{ '--guess': dialAt(guess), '--actual': dialAt(round.peak || 0), '--never': NEVER_FROM }}
        >
          <div className="peak-dial__readout" aria-live="polite">
            <span key={revealed ? 'answer' : 'guess'} className="peak-dial__value">
              {revealed ? peakLabel(round.peak || 0) : peakLabel(guess)}
            </span>
            <span className="peak-dial__sub">
              {revealed ? `You said ${peakLabel(result.guess)}` : 'Drag to where it peaked on the Hot 100'}
            </span>
          </div>

          <div className="peak-dial__rail">
            <div className="peak-dial__track" aria-hidden="true">
              <span className="peak-dial__never" />
            </div>
            {revealed && <span className="peak-dial__gap" aria-hidden="true" />}
            {revealed && <span className="peak-dial__actual" aria-hidden="true" />}
            <input
              type="range"
              className="peak-dial__input"
              min="0"
              max="1000"
              step="1"
              value={Math.round((revealed ? dialAt(result.guess) : position) * 1000)}
              onChange={move}
              disabled={revealed || locking}
              aria-label="Where it peaked on the Hot 100"
              aria-valuetext={peakLabel(guess)}
            />
          </div>

          <div className="peak-dial__ticks" aria-hidden="true">
            {TICKS.map(t => <span key={t} style={{ '--at': dialAt(t) }}>#{t}</span>)}
            <span className="peak-dial__tick-never" style={{ '--at': (NEVER_FROM + 1) / 2 }}>Never</span>
          </div>

          {revealed ? (
            <div className="peak-dial__outcome">
              <p className="peak-dial__verdict">
                <span className="peak-dial__points">+{fmtPoints(result.points)}</span>
                <span>{verdictText(round)}</span>
              </p>
              <button type="button" className="peak-dial__action btn-press" onClick={advance}>
                {isLast ? 'See how you did' : 'Next song'}
                <Icon name="chevronRight" size={15} strokeWidth={2.5} />
              </button>
            </div>
          ) : (
            <button type="button" className="peak-dial__action btn-press" onClick={lockIn} disabled={locking}>
              Lock in {peakLabel(guess)}
            </button>
          )}
        </div>
      )}

      {done && (
        <ResultCard
          justFinished={justFinished}
          correct={isWin(finalPoints, maxPoints)}
          status={`${fmtPoints(finalPoints)} points`}
          answer={best != null ? `Closest call: ${rounds[best].title}` : `Out of ${fmtPoints(maxPoints)}`}
          artist={best != null
            ? `You said ${peakLabel(results[best].guess)}, ${rounds[best].peak ? `it peaked at #${rounds[best].peak}` : 'it never charted'}`
            : undefined}
          emojiGrid={squares}
          shareLine={`${fmtPoints(finalPoints)} / ${fmtPoints(maxPoints)} points`}
          points={finalPoints}
          maxPoints={maxPoints}
          gameSlug={SLUG}
          puzzleDate={dateParam}
          timeSeconds={competitive ? finalTime : null}
          nextGame={{ path: '/game/era', label: 'Era' }}
          showLeaderboard={competitive}
        />
      )}
    </Shell>
  )
}
