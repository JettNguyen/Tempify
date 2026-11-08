import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { useCustomRecord } from '../hooks/useCustomRecord'
import { useGameTimer } from '../hooks/useGameTimer'
import { exitTarget } from '../lib/gameExit'
import { saveScore, updateStreak } from '../lib/scores'
import { prefetchClip } from '../lib/audioEngine'
import { hapticImportantTap, hapticSelection } from '../lib/haptics'
import { playSound, playVerdict } from '../lib/sounds'
import { lockInDelay } from '../lib/lockIn'
import { NEVER_FROM, dialAt, peakAt, peakPoints, peakLabel } from '../lib/peak'
import { ROUND_MAX, isWin, fmtPoints, roundTier, shareSquares, loadRounds, saveRounds } from '../lib/points'
import { readChallenge } from '../lib/challenge'
import { nextGameAfter } from '../lib/games'
import { customNext } from '../lib/customGames'
import AudioPlayer from '../components/AudioPlayer'
import GameHeader from '../components/GameHeader'
import StageSong from '../components/StageSong'
import ResultCard from '../components/ResultCard'
import { ChallengeTally } from '../components/Challenge'
import Icon from '../components/Icon'
import Dial from '../components/Dial'
import './Peak.css'

const SLUG = 'hit-or-miss'

// The thumb starts on the #25 mark: about the middle of the charted stretch, so
// no first guess is pulled toward either end, and a number that looks chosen.
const START_AT = dialAt(25)

// The top ten take up as much of the dial as #40 to #100, so the marks
// crowd the top. #100 goes unmarked: it sits right against "Never".
const TICKS = [1, 10, 25, 50]

// Where a peak sits going down the dial, with never-charted past #100.
const dialRank = (peak) => (peak === 0 ? 101 : peak)

/** Whether a move lands on a mark, or Never, or skips over one. */
function passesMark(before, after) {
  const from = dialRank(before)
  const to = dialRank(after)
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  return [...TICKS, 101].some(m => m >= lo && m <= hi && m !== from)
}

function weeksText(n, what) {
  return `${n} week${n === 1 ? '' : 's'} ${what}`
}

// A guess as a sentence goes on: "You said #12", "You said it never charted".
const saidText = (guess) => (guess ? `#${guess}` : 'it never charted')

function verdictText(round) {
  if (!round.peak) return 'It never made the Hot 100'
  const parts = [`Peaked at #${round.peak}`]
  if (round.weeks_at_one) parts.push(weeksText(round.weeks_at_one, 'at #1'))
  else if (round.weeks_on_chart) parts.push(weeksText(round.weeks_on_chart, 'on the chart'))
  return parts.join(' · ')
}

/**
 * Hit or Miss, a few songs at a time (three from 11/17/2026), as a dial: drag to where each one peaked
 * on the Hot 100, or past #100 to say it never charted. Each lock-in shows how
 * far off it was and pays up to 1,000 for being close.
 *
 * `custom` is set for a game a player made: `puzzleDate` is then its key
 * on this device, and the finish goes to its own board, not the day's.
 */
export default function Peak({ puzzle, puzzleDate, dateParam, Shell, custom }) {
  const { user, profile } = useAuth()
  const { markComplete, isComplete, completions } = useCompletion(user?.id)
  const record = useCustomRecord(custom)
  const [searchParams] = useSearchParams()
  const rounds = puzzle.metadata.rounds
  const maxPoints = rounds.length * ROUND_MAX
  const competitive = profile?.competitive_mode !== false

  const [results, setResults] = useState(() => loadRounds(SLUG, puzzleDate).slice(0, rounds.length))
  // A friend's score, when this was opened from their challenge link.
  const challenge = readChallenge(searchParams, rounds.length)
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
    if ((record ? record.finished : isComplete(SLUG, puzzleDate)) || results.length >= rounds.length) {
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
  const savedPoints = record ? record.saved?.points : completions[`${SLUG}|${puzzleDate}`]?.points
  const finalPoints = results.length === rounds.length ? total : (savedPoints ?? total)
  const guess = revealed ? result.guess : peakAt(position)

  function move(next) {
    const before = peakAt(position)
    const after = peakAt(next)
    // A tick at the two ends rather than every place: a buzz per number would
    // be a buzz storm on one swipe. The marks between are heard, not felt.
    if (after !== before) {
      if (after === 0 || after === 1) hapticSelection('tick')
      else if (passesMark(before, after)) playSound('tick')
    }
    setPosition(next)
  }

  async function finish(all, elapsed) {
    const points = all.reduce((sum, r) => sum + r.points, 0)
    const won = isWin(points, maxPoints)
    if (record) {
      record.finish({ attempts: 1, completed: won, points })
      return
    }
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
      playVerdict(roundTier(points))
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
      <Link to={custom ? custom.back : exitTarget(searchParams)} replace className="game-back-link tap-target"><Icon name="chevronLeft" size={14} />Back</Link>

      <GameHeader
        slug={SLUG}
        name="hit or miss"
        puzzleDate={puzzleDate}
        title="How high did it chart?"
        timer={!done && competitive ? { text: display, running: !locking && !revealed } : null}
        tag={custom?.tag}
      />

      <div className="peak__progress">
        <span className="peak__pips" aria-label={`Song ${index + 1} of ${rounds.length}`}>
          {rounds.map((_, i) => {
            const r = results[i]
            const state = r ? roundTier(r.points) : i === index && !done ? 'now' : 'todo'
            return <span key={i} className={`peak__pip peak__pip--${state}`} />
          })}
        </span>
        <span className="peak__total">
          {fmtPoints(done ? finalPoints : total)} pts
          <ChallengeTally challenge={challenge} played={results.length} />
        </span>
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
        <Dial
          position={revealed ? dialAt(result.guess) : position}
          steps={1000}
          onMove={move}
          answerAt={revealed ? dialAt(round.peak || 0) : null}
          tier={tier}
          locking={locking}
          zoneFrom={NEVER_FROM}
          ticks={[
            ...TICKS.map(t => ({ at: dialAt(t), label: `#${t}` })),
            { at: (NEVER_FROM + 1) / 2, label: 'Never', zone: true },
          ]}
          value={revealed ? peakLabel(round.peak || 0) : peakLabel(guess)}
          sub={revealed ? `You said ${saidText(result.guess)}` : 'Drag to where it peaked on the Hot 100'}
          label="Where it peaked on the Hot 100"
          valueText={peakLabel(guess)}
        >
          {revealed ? (
            <div className="dial__outcome">
              <p className="dial__verdict">
                <span className="dial__points">+{fmtPoints(result.points)}</span>
                <span>{verdictText(round)}</span>
              </p>
              <button type="button" className="dial__action btn-press" onClick={advance}>
                {isLast ? 'See how you did' : 'Next song'}
                <Icon name="chevronRight" size={15} strokeWidth={2.5} />
              </button>
            </div>
          ) : (
            <button type="button" className="dial__action btn-press" onClick={lockIn} disabled={locking}>
              Lock in {peakLabel(guess)}
            </button>
          )}
        </Dial>
      )}

      {done && (
        <ResultCard
          justFinished={justFinished}
          correct={isWin(finalPoints, maxPoints)}
          status={`${fmtPoints(finalPoints)} points`}
          answer={best != null ? `Closest call: ${rounds[best].title}` : `Out of ${fmtPoints(maxPoints)}`}
          artist={best != null
            ? `You said ${saidText(results[best].guess)}, ${rounds[best].peak ? `it peaked at #${rounds[best].peak}` : results[best].guess ? 'it never charted' : "and it didn't"}`
            : undefined}
          emojiGrid={squares}
          shareLine={`${fmtPoints(finalPoints)} / ${fmtPoints(maxPoints)} points`}
          points={finalPoints}
          maxPoints={maxPoints}
          rounds={{
            date: puzzleDate,
            points: results.length === rounds.length ? results.map(r => r.points) : [],
            labels: rounds.map(r => r.title),
          }}
          gameSlug={SLUG}
          puzzleDate={dateParam}
          timeSeconds={competitive ? finalTime : null}
          nextGame={custom ? customNext(custom) : nextGameAfter('hit-or-miss', puzzleDate)}
          showLeaderboard={competitive}
          custom={custom && { ...custom, posted: record.posted }}
        />
      )}
    </Shell>
  )
}
