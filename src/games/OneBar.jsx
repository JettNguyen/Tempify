import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { todayEST, fmtDayShort } from '../lib/date'
import { exitTarget } from '../lib/gameExit'
import { getPuzzle, getCachedPuzzle } from '../lib/puzzles'
import { findArtwork, stripVariant } from '../lib/deezer'
import { prefetchArtworkUrls } from '../lib/artwork'
import { saveScore, updateStreak } from '../lib/scores'
import { sharesArtist } from '../lib/matching'
import { hapticImportantTap, hapticWrong, hapticRejected, hapticThreshold } from '../lib/haptics'
import AudioPlayer from '../components/AudioPlayer'
import GameHeader from '../components/GameHeader'
import GuessInput from '../components/GuessInput'
import ResultCard from '../components/ResultCard'
import Icon from '../components/Icon'
import DelayedSpinner from '../components/DelayedSpinner'
import './OneBar.css'

const MAX_ATTEMPTS = 6
const BASE_SECONDS = 0.5
const REVEAL_TIMINGS = [0.5, 1, 2, 5, 15, 30]
// What the progress bar stands for while guessing: the full length the clip can
// reach, so each unlock visibly claims more of it.
const MAX_REVEAL = REVEAL_TIMINGS[REVEAL_TIMINGS.length - 1]
// How long a newly won stage of audio stays lit on the ladder.
const FRESH_MS = 1400

// What a near miss gets told. Said as soon as the guess lands: knowing you are
// close is the part of the round worth having before the answer.
const HINTS = {
  artist: 'Right artist',
  title: 'Right title, wrong artist',
}

const progressKey = (date) => `tempify_progress_one-bar_${date}`

export default function OneBar() {
  const { user, profile } = useAuth()
  const { markComplete, isComplete, completions } = useCompletion(user?.id)
  const [searchParams] = useSearchParams()
  const dateParam = searchParams.get('date') || undefined
  const puzzleDate = dateParam || todayEST()

  // Seeded from the session cache the home screen warmed, so a tapped tile
  // paints the real screen immediately instead of an empty shell.
  const cachedPuzzle = getCachedPuzzle('one-bar', dateParam)
  const [puzzle, setPuzzle] = useState(cachedPuzzle)
  const [loading, setLoading] = useState(!cachedPuzzle)
  const [error, setError] = useState(null)

  const guessInputRef = useRef(null)
  const audioRef = useRef(null)
  // Set by Skip, consumed once the longer clip length has actually landed on
  // the player. Playing straight from the handler would race the state update
  // and cut off at the old limit.
  const playOnUnlockRef = useRef(false)

  const [attempts, setAttempts] = useState([])
  const [done, setDone] = useState(false)
  const [justFinished, setJustFinished] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [revealSeconds, setRevealSeconds] = useState(BASE_SECONDS)
  const [resultArtwork, setResultArtwork] = useState(null)
  const [notice, setNotice] = useState(null)
  // The stage of the ladder a wrong guess just won, lit for a moment.
  const [freshSegment, setFreshSegment] = useState(null)

  useEffect(() => {
    // Already seeded from cache, since refetching would only re-run derived
    // state (option order) and make the screen jump.
    if (cachedPuzzle) return
    getPuzzle('one-bar', dateParam)
      .then(setPuzzle)
      .catch(() => setError('No puzzle found for today.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!puzzle || done) return
    if (isComplete('one-bar', puzzleDate)) {
      localStorage.removeItem(progressKey(puzzleDate))
      const stored = completions[`one-bar|${puzzleDate}`]
      const count = stored?.attempts || 1
      const wasCorrect = stored?.completed ?? false
      const fake = Array.from({ length: count }, (_, i) => ({
        title: i === count - 1 && wasCorrect ? puzzle.answer : '-',
        artist: '',
        correct: i === count - 1 && wasCorrect,
      }))
      setAttempts(fake)
      setCorrect(wasCorrect)
      setRevealSeconds(REVEAL_TIMINGS[Math.min(count - 1, REVEAL_TIMINGS.length - 1)])
      setDone(true)
    }
  }, [puzzle, completions])

  useEffect(() => {
    if (!puzzle) return

    let cancelled = false
    const existing = puzzle.metadata?.artwork_url || null
    if (existing) {
      setResultArtwork(existing)
      prefetchArtworkUrls([existing])
      return
    }

    const title = puzzle.answer
    const artist = puzzle.metadata?.artist
    if (!title) return

    findArtwork({ title, artist })
      .then((url) => {
        if (!cancelled && url) {
          setResultArtwork(url)
          prefetchArtworkUrls([url])
        }
      })
      .catch(() => {
        // Keep fallback UI if lookup fails.
      })

    return () => { cancelled = true }
  }, [puzzle])

  // Restore mid-game guesses from localStorage so navigating away doesn't let
  // the player restart with a clean slate.
  useEffect(() => {
    if (!puzzle || done) return
    if (isComplete('one-bar', puzzleDate)) return
    try {
      const saved = JSON.parse(localStorage.getItem(progressKey(puzzleDate)) || 'null')
      if (saved?.attempts?.length > 0) {
        setAttempts(saved.attempts)
        setRevealSeconds(saved.revealSeconds ?? BASE_SECONDS)
      }
    } catch { /* ignore corrupt data */ }
  }, [puzzle, completions])

  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(null), 2500)
    return () => clearTimeout(id)
  }, [notice])

  useEffect(() => {
    if (freshSegment == null) return
    const id = setTimeout(() => setFreshSegment(null), FRESH_MS)
    return () => clearTimeout(id)
  }, [freshSegment])

  // Child effects run before parent ones, so by now the player is holding the
  // newly unlocked length and will let the clip run that far.
  useEffect(() => {
    if (!playOnUnlockRef.current) return
    playOnUnlockRef.current = false
    const p = audioRef.current?.restart()
    if (p?.catch) p.catch(() => {})
  }, [revealSeconds])

  function buildEmojiGrid() {
    return attempts.map((a) => (a.correct ? '🟩' : a.hint ? '🟨' : '⬜')).join('')
  }

  async function registerAttempt(attempt) {
    const newAttempts = [...attempts, attempt]
    setAttempts(newAttempts)

    if (attempt.correct || newAttempts.length >= MAX_ATTEMPTS) {
      // A skip that ends the round unlocks nothing, so the flag it set would
      // sit there armed and fire on whatever moved the clip length next.
      playOnUnlockRef.current = false
      setCorrect(attempt.correct)
      setDone(true)
      setJustFinished(true)
      localStorage.removeItem(progressKey(puzzleDate))
      markComplete('one-bar', puzzleDate, newAttempts.length, attempt.correct)
      if (user) {
        try {
          await saveScore({ userId: user.id, gameSlug: 'one-bar', puzzleDate, attempts: newAttempts.length, completed: attempt.correct })
          if (attempt.correct) await updateStreak(user.id, 'one-bar')
        } catch (err) {
          console.error('[Tempify] OneBar score save error:', err.message)
        }
      }
    } else {
      // Wrong, but the round continues, distinct from the failure buzz the
      // result card fires when the last guess is spent. A near miss gets a
      // firmer, rounder tap than a plain miss.
      if (attempt.hint) hapticThreshold()
      else if (!attempt.skipped) hapticWrong()
      guessInputRef.current?.clear()
      const nextReveal = REVEAL_TIMINGS[Math.min(newAttempts.length, REVEAL_TIMINGS.length - 1)]
      setRevealSeconds(nextReveal)
      setFreshSegment(newAttempts.length)
      localStorage.setItem(progressKey(puzzleDate), JSON.stringify({ attempts: newAttempts, revealSeconds: nextReveal }))
    }
  }

  async function handleGuess(song) {
    if (done || attempts.length >= MAX_ATTEMPTS) return

    // A repeat guess tells the player nothing new, so don't let it burn a turn.
    const guessKey = `${stripVariant(song.title).toLowerCase()}|||${song.artist.toLowerCase()}`
    const isRepeat = attempts.some((a) => (
      !a.skipped && `${stripVariant(a.title || '').toLowerCase()}|||${(a.artist || '').toLowerCase()}` === guessKey
    ))
    if (isRepeat) {
      hapticRejected()
      setNotice(`You already guessed “${song.title}”.`)
      guessInputRef.current?.clear()
      return
    }

    setNotice(null)
    hapticImportantTap()

    const titleMatch = stripVariant(song.title).toLowerCase() === puzzle.answer.toLowerCase().trim()
    const artistMatch = !puzzle.metadata?.artist ||
      song.artist.toLowerCase().trim() === puzzle.metadata.artist.toLowerCase().trim()
    const isCorrect = titleMatch && artistMatch

    // The answer check above stays exact. This only decides whether a wrong
    // guess was near enough to say so.
    let hint
    if (!isCorrect) {
      if (titleMatch) hint = 'title'
      else if (puzzle.metadata?.artist && sharesArtist(song.artist, puzzle.metadata.artist)) hint = 'artist'
    }

    await registerAttempt({ title: song.title, artist: song.artist, correct: isCorrect, ...(hint ? { hint } : {}) })
  }

  async function handleSkip() {
    if (done || attempts.length >= MAX_ATTEMPTS) return
    hapticImportantTap()

    // The whole point of skipping is to hear more, so don't make them press
    // play as well. A skip that ends the round remounts the player with the
    // full track on autoplay, so the flag simply goes unused there.
    playOnUnlockRef.current = true
    await registerAttempt({ title: 'Skipped', artist: '', correct: false, skipped: true })
  }

  if (loading) return <GameShell><DelayedSpinner active={loading} label="Loading puzzle..." /></GameShell>
  if (error) return <GameShell><p style={{ color: 'var(--text-muted)' }}>{error}</p></GameShell>
  if (!puzzle) return null

  const remainingGuesses = MAX_ATTEMPTS - attempts.length
  const nextReveal = REVEAL_TIMINGS[Math.min(attempts.length + 1, REVEAL_TIMINGS.length - 1)]

  // The ladder under the clip: what each guess came to, the stage being played
  // now, and what is still locked.
  const ladder = REVEAL_TIMINGS.map((secs, i) => {
    const a = attempts[i]
    if (a?.correct) return { content: <Icon name="check" size={11} strokeWidth={3.25} />, tone: 'right' }
    if (a?.skipped) return { content: <Icon name="skipForward" size={11} strokeWidth={2.5} />, tone: 'skipped' }
    if (a) return { content: <Icon name="x" size={11} strokeWidth={3.25} />, tone: a.hint ? 'close' : 'wrong' }
    return { content: `${secs}s`, tone: i === attempts.length ? 'current' : 'locked' }
  })

  return (
    <GameShell>
      <Link to={exitTarget(searchParams)} replace className="game-back-link tap-target"><Icon name="chevronLeft" size={14} />Back</Link>

      <GameHeader
        slug="one-bar"
        name="one bar"
        date={fmtDayShort(puzzleDate)}
        title="Name the song from a short clip. Each wrong guess unlocks a bit more."
      />

      <AudioPlayer
        ref={audioRef}
        key={done ? 'done' : 'playing'}
        variant="stage"
        visual="bars"
        src={puzzle.audio_url}
        maxDuration={done ? undefined : revealSeconds}
        trackSpan={done ? undefined : MAX_REVEAL}
        segmentStops={done ? undefined : REVEAL_TIMINGS}
        segmentLabels={done ? undefined : ladder}
        freshSegment={done ? null : freshSegment}
        autoplay={done ? true : profile?.autoplay_audio !== false}
      />

      {done && (
        <div className="one-bar__progress">
          {correct ? (
            <div className="one-bar__solved">
              <p className="one-bar__solved-label">Solved with</p>
              <p className="one-bar__solved-figure">
                <span className="one-bar__solved-value">{revealSeconds}s</span>
                <span className="one-bar__solved-total">of {MAX_REVEAL}s</span>
              </p>
              {/* Half a second only reads as good against the thirty it could
                  have taken, so the figure gets something to sit against. */}
              <div className="one-bar__solved-track">
                <div
                  className="one-bar__solved-fill"
                  style={{ width: `${Math.max(2, (revealSeconds / MAX_REVEAL) * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="one-bar__progress-label">Better luck tomorrow</p>
          )}
        </div>
      )}

      {!done && (
        <div className="one-bar__play">
          <GuessInput ref={guessInputRef} onGuess={handleGuess} disabled={done} />
          {notice && <p className="one-bar__notice" role="status">{notice}</p>}

          <div className="one-bar__actions">
            {/* On the last guess there is nothing left to unlock, so the button
                forfeits the round, and should say so rather than inviting a tap
                that reads as harmless. */}
            <button
              type="button"
              onClick={handleSkip}
              className={`one-bar__skip btn-press${remainingGuesses === 1 ? ' one-bar__skip--final' : ''}`}
            >
              <Icon name={remainingGuesses === 1 ? 'alert' : 'skipForward'} size={14} />
              {remainingGuesses === 1 ? 'Give up and reveal the answer' : `Skip to hear ${nextReveal}s`}
            </button>
            <p className="one-bar__left" aria-live="polite">
              <span className="one-bar__left-count">{remainingGuesses}</span>
              {remainingGuesses === 1 ? ' guess left' : ' guesses left'}
            </p>
          </div>
        </div>
      )}

      {attempts.length > 0 && !done && (
        <ol className="one-bar__guesses">
          {attempts.map((a, i) => (
            <li
              key={i}
              className={[
                'one-bar__guess',
                a.skipped ? 'one-bar__guess--skipped' : '',
                a.hint ? 'one-bar__guess--close' : '',
                i === attempts.length - 1 ? 'one-bar__guess--latest' : '',
              ].filter(Boolean).join(' ')}
            >
              <span className="one-bar__guess-mark">
                <Icon name={a.skipped ? 'skipForward' : 'x'} size={11} strokeWidth={a.skipped ? 2.5 : 3} />
              </span>
              <span className="one-bar__guess-text">
                {a.skipped ? `Skipped at ${REVEAL_TIMINGS[i]}s` : `${a.title} by ${a.artist}`}
              </span>
              {a.hint && <span className="one-bar__guess-tag">{HINTS[a.hint]}</span>}
            </li>
          ))}
        </ol>
      )}

      {done && (
        <ResultCard
          justFinished={justFinished}
          correct={correct}
          answer={puzzle.answer}
          artist={puzzle.metadata?.artist}
          artwork={{
            title: puzzle.answer,
            artist: puzzle.metadata?.artist,
            src: resultArtwork || puzzle.metadata?.artwork_url,
          }}
          emojiGrid={buildEmojiGrid()}
          attempts={attempts.length}
          gameSlug="one-bar"
          puzzleDate={dateParam}
          nextGame={{ path: '/game/hit-or-miss', label: 'Hit or Miss' }}
          showLeaderboard={profile?.competitive_mode !== false}
        />
      )}
    </GameShell>
  )
}

function GameShell({ children }) {
  return <div className="page-shell game-theme--one-bar">{children}</div>
}
