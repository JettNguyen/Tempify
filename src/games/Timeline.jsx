import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { useGameTimer } from '../hooks/useGameTimer'
import { exitTarget } from '../lib/gameExit'
import { saveScore, updateStreak } from '../lib/scores'
import { prefetchClip } from '../lib/audioEngine'
import { hapticImportantTap, hapticSelection } from '../lib/haptics'
import { playVerdict } from '../lib/sounds'
import { lockInDelay } from '../lib/lockIn'
import { rightGaps, gapPoints, gapLabel } from '../lib/timeline'
import { ROUND_MAX, isWin, fmtPoints, roundTier, shareSquares, loadRounds, saveRounds } from '../lib/points'
import { readChallenge } from '../lib/challenge'
import AudioPlayer from '../components/AudioPlayer'
import GameHeader from '../components/GameHeader'
import StageSong from '../components/StageSong'
import ResultCard from '../components/ResultCard'
import { ChallengeTally } from '../components/Challenge'
import Icon from '../components/Icon'
import './Timeline.css'

const SLUG = 'era'

const byYear = (a, b) => a.year - b.year

function reducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

/**
 * Era, five songs at a time: the first starts on the line with its year
 * showing, and each one after is heard without its name and dropped into a
 * gap on the line. The name comes with the answer.
 */
export default function Timeline({ puzzle, puzzleDate, dateParam, Shell }) {
  const { user, profile } = useAuth()
  const { markComplete, isComplete, completions } = useCompletion(user?.id)
  const [searchParams] = useSearchParams()
  const rounds = puzzle.metadata.rounds
  const toPlace = rounds.length - 1
  const maxPoints = toPlace * ROUND_MAX
  const competitive = profile?.competitive_mode !== false

  // One result per placed song: rounds[1] onward.
  const [results, setResults] = useState(() => loadRounds(SLUG, puzzleDate).slice(0, toPlace))
  // A friend's score, when this was opened from their challenge link.
  const challenge = readChallenge(searchParams, toPlace)
  // The song on the stage. A placed song stays up with its answer until
  // "Next song".
  const [index, setIndex] = useState(() => Math.min(results.length + 1, toPlace))
  const [picked, setPicked] = useState(null)
  const [hasStarted, setHasStarted] = useState(results.length > 0)
  const [done, setDone] = useState(false)
  const [justFinished, setJustFinished] = useState(false)
  const [finalTime, setFinalTime] = useState(null)
  const revealRef = useRef(0)
  const playedRef = useRef(false)
  const lineRef = useRef(null)

  const { stop, display } = useGameTimer(hasStarted && !done, 250, `tempify_game_${SLUG}_${puzzleDate}`)

  useEffect(() => {
    rounds.slice(1).forEach((r) => prefetchClip(r.audio_url))
  }, [rounds])

  useEffect(() => {
    if (done || playedRef.current) return
    if (isComplete(SLUG, puzzleDate) || results.length >= toPlace) {
      stop()
      setDone(true)
    }
  }, [completions])

  useEffect(() => () => clearTimeout(revealRef.current), [])

  // By the last song the line is four songs and five gaps, taller than a
  // small phone has room for under the stage. Each new song brings the gaps
  // into view, so the bottom one is never a stretch away. The clip plays on
  // its own, so the stage can afford to slide up.
  useEffect(() => {
    if (done || index < 2) return
    const line = lineRef.current
    if (!line || line.getBoundingClientRect().bottom <= window.innerHeight) return
    line.scrollIntoView({ block: 'end', behavior: reducedMotion() ? 'auto' : 'smooth' })
  }, [index, done])

  const round = rounds[index]
  const result = results[index - 1]
  const revealed = Boolean(result)
  const total = results.reduce((sum, r) => sum + (r.points || 0), 0)
  const savedPoints = completions[`${SLUG}|${puzzleDate}`]?.points
  const finalPoints = results.length === toPlace ? total : (savedPoints ?? total)

  // What's on the line: every song before this one, and this one too once
  // it has been placed.
  const onLine = (done ? rounds : rounds.slice(0, revealed ? index + 1 : index))
    .map((r, i) => ({ ...r, i }))
    .sort(byYear)
  const before = rounds.slice(0, index).map(r => r.year).sort((a, b) => a - b)

  async function finish(all, elapsed) {
    const points = all.reduce((sum, r) => sum + r.points, 0)
    const won = isWin(points, maxPoints)
    markComplete(SLUG, puzzleDate, 1, won, points)
    if (!user) return
    try {
      await saveScore({ userId: user.id, gameSlug: SLUG, puzzleDate, attempts: 1, completed: won, timeSeconds: competitive ? elapsed : null, points })
      if (won) await updateStreak(user.id, SLUG, profile?.is_subscribed)
    } catch (err) {
      console.error('[Tempify] Timeline score save error:', err.message)
    }
  }

  function place(gap) {
    if (picked != null || revealed || done) return
    hapticImportantTap()
    playedRef.current = true
    setHasStarted(true)
    const points = gapPoints(gap, rightGaps(before, round.year))
    const all = [...results, { gap, points }]
    // Written at the tap, so leaving during the beat can't hand the same
    // song back with its year already seen.
    saveRounds(SLUG, puzzleDate, all)
    if (all.length === toPlace) {
      const elapsed = stop()
      setFinalTime(elapsed)
      finish(all, elapsed)
    }
    setPicked(gap)
    revealRef.current = setTimeout(() => {
      revealRef.current = 0
      setPicked(null)
      setResults(all)
      playVerdict(roundTier(points))
    }, lockInDelay())
  }

  function advance() {
    hapticSelection()
    if (index < toPlace) {
      setIndex(index + 1)
    } else {
      setDone(true)
      setJustFinished(true)
    }
  }

  // A row's mark, once its song has been placed.
  function rowState(i) {
    if (i === 0) return 'anchor'
    const r = results[i - 1]
    if (!r) return null
    return roundTier(r.points)
  }

  const isLast = index === toPlace
  const showSong = revealed || done
  const squares = results.length === toPlace ? shareSquares(results.map(r => r.points)) : null
  const right = results.filter(r => r.points === ROUND_MAX).length

  let timer = null
  if (!done && competitive) {
    timer = hasStarted ? { text: display, running: picked == null && !revealed } : { text: 'Starts on play', idle: true }
  }

  return (
    <Shell className="timeline">
      <Link to={exitTarget(searchParams)} replace className="game-back-link tap-target"><Icon name="chevronLeft" size={14} />Back</Link>

      <GameHeader
        slug={SLUG}
        name="era"
        puzzleDate={puzzleDate}
        title={done ? 'How the line came out' : 'Where does this one go?'}
        timer={timer}
      />

      <div className="timeline__progress">
        <span className="timeline__pips" aria-label={`Song ${index} of ${toPlace}`}>
          {rounds.slice(1).map((_, i) => {
            const r = results[i]
            const state = r ? roundTier(r.points) : i + 1 === index && !done ? 'now' : 'todo'
            return <span key={i} className={`timeline__pip timeline__pip--${state}`} />
          })}
        </span>
        <span className="timeline__total">
          {fmtPoints(done ? finalPoints : total)} pts
          <ChallengeTally challenge={challenge} played={results.length} />
        </span>
      </div>

      <AudioPlayer
        key={index}
        variant="stage"
        visual="record"
        src={round.audio_url}
        onPlay={() => setHasStarted(true)}
        autoplay={!done && profile?.autoplay_audio !== false}
      >
        {showSong && <StageSong title={round.title} artist={round.artist} meta={round.year} src={round.artwork_url} />}
      </AudioPlayer>

      <ol ref={lineRef} className={`timeline__line${picked != null ? ' timeline__line--locking' : ''}`}>
        {onLine.map((r, pos) => {
          const state = rowState(r.i)
          const fresh = revealed && !done && r.i === index
          const gapHere = !revealed && !done
          const mine = r.i > 0 ? results[r.i - 1] : null
          return (
            <li key={r.i} className="timeline__item">
              {gapHere && (
                <Gap gap={pos} label={gapLabel(before, pos)} picked={picked} onPick={place} />
              )}
              <button
                type="button"
                className={`timeline__song btn-press${state ? ` timeline__song--${state}` : ''}${fresh ? ' timeline__song--fresh' : ''}${done && r.i === index ? ' timeline__song--on' : ''}`}
                onClick={() => { if (done) { hapticSelection(); setIndex(r.i) } }}
                disabled={!done}
                aria-label={done ? `Play ${r.title}` : undefined}
              >
                <span className="timeline__year">{r.year}</span>
                <span className="timeline__name">
                  <span className="timeline__title">{r.title}</span>
                  <span className="timeline__artist">
                    {r.artist}
                    {fresh && mine && mine.points < ROUND_MAX && ` · you said ${gapLabel(rounds.slice(0, r.i).map(x => x.year).sort((a, b) => a - b), mine.gap).toLowerCase()}`}
                  </span>
                </span>
                {mine && (done || fresh) && (
                  <span className={`timeline__points timeline__points--${state}`}>{fmtPoints(mine.points)}</span>
                )}
                {state === 'anchor' && <span className="timeline__start">Start</span>}
              </button>
            </li>
          )
        })}
        {!revealed && !done && (
          <li className="timeline__item">
            <Gap gap={onLine.length} label={gapLabel(before, onLine.length)} picked={picked} onPick={place} />
          </li>
        )}
      </ol>

      {revealed && !done && (
        <button type="button" className="timeline__next btn-press" onClick={advance}>
          {isLast ? 'See how you did' : 'Next song'}
          <Icon name="chevronRight" size={15} strokeWidth={2.5} />
        </button>
      )}

      {done && (
        <ResultCard
          justFinished={justFinished}
          correct={isWin(finalPoints, maxPoints)}
          status={`${fmtPoints(finalPoints)} points`}
          answer={results.length === toPlace ? `${right} of ${toPlace} in the right place` : `Out of ${fmtPoints(maxPoints)}`}
          artist={[...rounds].sort(byYear).map(r => r.year).join(' · ')}
          emojiGrid={squares}
          shareLine={`${fmtPoints(finalPoints)} / ${fmtPoints(maxPoints)} points`}
          points={finalPoints}
          maxPoints={maxPoints}
          rounds={{
            date: puzzleDate,
            points: results.length === toPlace ? results.map(r => r.points) : [],
            labels: rounds.slice(1).map(r => r.title),
          }}
          gameSlug={SLUG}
          puzzleDate={dateParam}
          timeSeconds={competitive ? finalTime : null}
          nextGame={{ path: '/game/cover-or-not', label: 'Cover or Not' }}
          showLeaderboard={competitive}
        />
      )}
    </Shell>
  )
}

function Gap({ gap, label, picked, onPick }) {
  const state = picked == null ? '' : picked === gap ? ' timeline__gap--locked' : ' timeline__gap--waiting'
  return (
    <button
      type="button"
      className={`timeline__gap btn-press${state}`}
      onClick={() => onPick(gap)}
      disabled={picked != null}
      aria-label={`Place it ${label.toLowerCase()}`}
    >
      <Icon name="plus" size={13} strokeWidth={2.5} />
      <span>{label}</span>
    </button>
  )
}
