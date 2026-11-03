import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { todayEST } from '../lib/date'
import { exitTarget } from '../lib/gameExit'
import { getPuzzle, getCachedPuzzle } from '../lib/puzzles'
import { saveScore, updateStreak } from '../lib/scores'
import { prefetchClip } from '../lib/audioEngine'
import { hapticImportantTap, hapticSelection } from '../lib/haptics'
import { playVerdict } from '../lib/sounds'
import { lockInDelay } from '../lib/lockIn'
import { addTap, bpmFromTaps, tempoOff, tempoPoints, MIN_TAPS } from '../lib/tempo'
import { ROUND_MAX, isWin, fmtPoints, roundTier, shareSquares, loadRounds, saveRounds } from '../lib/points'
import { readChallenge } from '../lib/challenge'
import { nextGameAfter } from '../lib/games'
import AudioPlayer from '../components/AudioPlayer'
import GameHeader from '../components/GameHeader'
import StageSong from '../components/StageSong'
import TrackArtwork from '../components/TrackArtwork'
import ResultCard from '../components/ResultCard'
import { ChallengeTally } from '../components/Challenge'
import Icon from '../components/Icon'
import DelayedSpinner from '../components/DelayedSpinner'
import './TapTempo.css'

const SLUG = 'tempo'

function percentOff(bpm, actual) {
  return Math.round(tempoOff(bpm, actual) * 100)
}

export default function TapTempo() {
  const [searchParams] = useSearchParams()
  const dateParam = searchParams.get('date') || undefined
  const puzzleDate = dateParam || todayEST()

  const cachedPuzzle = getCachedPuzzle(SLUG, dateParam)
  const [puzzle, setPuzzle] = useState(cachedPuzzle)
  const [loading, setLoading] = useState(!cachedPuzzle)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (cachedPuzzle) return
    getPuzzle(SLUG, dateParam)
      .then(setPuzzle)
      .catch(() => setError('No puzzle found for today.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <GameShell><DelayedSpinner active={loading} label="Loading puzzle..." /></GameShell>
  if (error || !puzzle?.metadata?.rounds?.length) {
    return <GameShell><p style={{ color: 'var(--text-muted)' }}>{error || 'No puzzle found for today.'}</p></GameShell>
  }
  return <TempoRounds puzzle={puzzle} puzzleDate={puzzleDate} dateParam={dateParam} />
}

/**
 * A few famous songs (three a day from 11/17/2026), named but not played. Tap each one's beat from memory,
 * lock it in, and then the clip plays with your beat pulsing beside the
 * song's.
 */
function TempoRounds({ puzzle, puzzleDate, dateParam }) {
  const { user, profile } = useAuth()
  const { markComplete, isComplete, completions } = useCompletion(user?.id)
  const [searchParams] = useSearchParams()
  const rounds = puzzle.metadata.rounds
  const maxPoints = rounds.length * ROUND_MAX
  const competitive = profile?.competitive_mode !== false

  const [results, setResults] = useState(() => loadRounds(SLUG, puzzleDate).slice(0, rounds.length))
  // A friend's score, when this was opened from their challenge link.
  const challenge = readChallenge(searchParams, rounds.length)
  const [index, setIndex] = useState(() => Math.min(results.length, rounds.length - 1))
  const [taps, setTaps] = useState([])
  const [locking, setLocking] = useState(false)
  const [done, setDone] = useState(false)
  const [justFinished, setJustFinished] = useState(false)
  const revealRef = useRef(0)
  const playedRef = useRef(false)

  // No clock: the beat is scored on how close it was, and a clock would only
  // hurry the tapping.

  useEffect(() => {
    rounds.forEach((r) => prefetchClip(r.audio_url))
  }, [rounds])

  useEffect(() => {
    if (done || playedRef.current) return
    if (isComplete(SLUG, puzzleDate) || results.length >= rounds.length) {
      setDone(true)
    }
  }, [completions])

  useEffect(() => () => clearTimeout(revealRef.current), [])

  const round = rounds[index]
  const result = results[index]
  const revealed = Boolean(result)
  const bpm = bpmFromTaps(taps)
  const total = results.reduce((sum, r) => sum + (r.points || 0), 0)
  const savedPoints = completions[`${SLUG}|${puzzleDate}`]?.points
  const finalPoints = results.length === rounds.length ? total : (savedPoints ?? total)

  function tap() {
    if (revealed || locking || done) return
    hapticSelection('beat')
    setTaps(prev => addTap(prev, performance.now()))
  }

  async function finish(all) {
    const points = all.reduce((sum, r) => sum + r.points, 0)
    const won = isWin(points, maxPoints)
    markComplete(SLUG, puzzleDate, 1, won, points)
    if (!user) return
    try {
      await saveScore({ userId: user.id, gameSlug: SLUG, puzzleDate, attempts: 1, completed: won, timeSeconds: null, points })
      if (won) await updateStreak(user.id, SLUG, profile?.is_subscribed)
    } catch (err) {
      console.error('[Tempify] TapTempo score save error:', err.message)
    }
  }

  function lockIn() {
    if (!bpm || locking || revealed || done) return
    hapticImportantTap()
    playedRef.current = true
    const points = tempoPoints(bpm, round.bpm)
    const all = [...results, { bpm, points }]
    saveRounds(SLUG, puzzleDate, all)
    if (all.length === rounds.length) finish(all)
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
    setTaps([])
    if (index < rounds.length - 1) {
      setIndex(index + 1)
    } else {
      setDone(true)
      setJustFinished(true)
    }
  }

  const tier = revealed ? roundTier(result.points) : null
  const isLast = index === rounds.length - 1
  const squares = results.length === rounds.length ? shareSquares(results.map(r => r.points)) : null
  const best = results.length === rounds.length
    ? results.reduce((b, r, i) => (r.points > results[b].points ? i : b), 0)
    : null
  const showClip = revealed || done

  return (
    <GameShell>
      <Link to={exitTarget(searchParams)} replace className="game-back-link tap-target"><Icon name="chevronLeft" size={14} />Back</Link>

      <GameHeader
        slug={SLUG}
        name="tap the tempo"
        puzzleDate={puzzleDate}
        title={showClip ? 'How close was your beat?' : 'Tap its beat from memory'}
      />

      <div className="tempo__progress">
        <span className="tempo__pips" aria-label={`Song ${index + 1} of ${rounds.length}`}>
          {rounds.map((_, i) => {
            const r = results[i]
            const state = r ? roundTier(r.points) : i === index && !done ? 'now' : 'todo'
            return <span key={i} className={`tempo__pip tempo__pip--${state}`} />
          })}
        </span>
        <span className="tempo__total">
          {fmtPoints(done ? finalPoints : total)} pts
          <ChallengeTally challenge={challenge} played={results.length} />
        </span>
      </div>

      {showClip ? (
        <AudioPlayer key={index} variant="stage" visual="bars" src={round.audio_url} autoplay={!done && profile?.autoplay_audio !== false}>
          <StageSong title={round.title} artist={round.artist} meta={round.year} src={round.artwork_url} />
        </AudioPlayer>
      ) : (
        // No player until the beat is in: hearing it first would be the answer.
        <div key={index} className="tempo__song">
          <TrackArtwork title={round.title} artist={round.artist} src={round.artwork_url} size="medium" />
          <p className="tempo__title">{round.title}</p>
          <p className="tempo__artist">{round.artist}{round.year ? ` · ${round.year}` : ''}</p>
        </div>
      )}

      {done ? (
        <ol className="tempo__summary">
          {rounds.map((r, i) => {
            const mine = results[i]
            return (
              <li key={i}>
                <button
                  type="button"
                  className={`tempo__summary-row btn-press${i === index ? ' tempo__summary-row--on' : ''}`}
                  onClick={() => { hapticSelection(); setIndex(i) }}
                  aria-label={`Play ${r.title}`}
                >
                  <span className="tempo__summary-song">
                    <span className="tempo__summary-title">{r.title}</span>
                    <span className="tempo__summary-artist">{r.artist}</span>
                  </span>
                  <span className="tempo__summary-call">
                    {mine && <span>You {mine.bpm}</span>}
                    <span className="tempo__summary-real">Song {r.bpm}</span>
                  </span>
                  {mine && (
                    <span className={`tempo__summary-points tempo__summary-points--${roundTier(mine.points)}`}>
                      {fmtPoints(mine.points)}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ol>
      ) : revealed ? (
        <div className={`tempo__outcome tempo__outcome--${tier}`}>
          <div className="tempo__beats">
            <Beat label="You" bpm={result.bpm} mine />
            <Beat label="The song" bpm={round.bpm} />
          </div>
          <p className="tempo__verdict">
            <span className="tempo__points">+{fmtPoints(result.points)}</span>
            <span>{result.points === ROUND_MAX ? 'Right on the beat' : `${percentOff(result.bpm, round.bpm)}% off`}</span>
          </p>
          <button type="button" className="tempo__action btn-press" onClick={advance}>
            {isLast ? 'See how you did' : 'Next song'}
            <Icon name="chevronRight" size={15} strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        <div className="tempo__tapping">
          <button
            type="button"
            className={`tempo__pad${bpm ? ' tempo__pad--steady' : ''}`}
            style={bpm ? { '--bpm': bpm } : undefined}
            onPointerDown={tap}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tap() } }}
            disabled={locking}
            aria-label="Tap the beat"
          >
            {/* Restarted on every tap, so each one lands as a ripple. */}
            {taps.length > 0 && <span key={taps[taps.length - 1]} className="tempo__ripple" aria-hidden="true" />}
            <span className="tempo__bpm" aria-live="polite">
              {bpm ?? (taps.length ? MIN_TAPS - taps.length : 'Tap')}
            </span>
            <span className="tempo__bpm-unit">
              {bpm ? 'BPM' : taps.length ? `more tap${MIN_TAPS - taps.length === 1 ? '' : 's'}` : 'the beat here'}
            </span>
          </button>
          <div className="tempo__controls">
            <button type="button" className="tempo__reset btn-press" onClick={() => setTaps([])} disabled={!taps.length || locking}>
              Start over
            </button>
            <button type="button" className="tempo__action btn-press" onClick={lockIn} disabled={!bpm || locking}>
              {bpm ? `Lock in ${bpm} BPM` : `Tap at least ${MIN_TAPS} times`}
            </button>
          </div>
        </div>
      )}

      {done && (
        <ResultCard
          justFinished={justFinished}
          correct={isWin(finalPoints, maxPoints)}
          status={`${fmtPoints(finalPoints)} points`}
          answer={best != null ? `Closest beat: ${rounds[best].title}` : `Out of ${fmtPoints(maxPoints)}`}
          artist={best != null ? `You tapped ${results[best].bpm}, the song runs at ${rounds[best].bpm}` : undefined}
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
          nextGame={nextGameAfter('tempo', puzzleDate)}
          showLeaderboard={competitive}
        />
      )}
    </GameShell>
  )
}

/** A dot pulsing at a tempo, so two tempos can be seen against each other. */
function Beat({ label, bpm, mine }) {
  return (
    <span className={`tempo__beat${mine ? ' tempo__beat--mine' : ''}`} style={{ '--bpm': bpm }}>
      <span className="tempo__beat-dot" aria-hidden="true" />
      <span className="tempo__beat-text">
        <span className="tempo__beat-bpm">{bpm}</span>
        <span className="tempo__beat-label">{label}</span>
      </span>
    </span>
  )
}

function GameShell({ children }) {
  return <div className="page-shell page-shell--fill game-theme--tempo">{children}</div>
}
