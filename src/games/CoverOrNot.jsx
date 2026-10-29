import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { useGameTimer } from '../hooks/useGameTimer'
import { todayEST, fmtDayShort } from '../lib/date'
import { exitTarget } from '../lib/gameExit'
import { getPuzzle, getCachedPuzzle } from '../lib/puzzles'
import { findArtwork } from '../lib/deezer'
import { prefetchArtworkUrls } from '../lib/artwork'
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
import './CoverOrNot.css'

// The game's symbol split in two: a cover is two takes on one song, overlapping;
// an original is the one take there is.
function CoverArt(props) {
  return (
    <svg viewBox="0 0 52 30" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true" {...props}>
      <circle className="cover-or-not__art-left" cx="18" cy="15" r="12" />
      <circle className="cover-or-not__art-right" cx="33" cy="15" r="12" />
    </svg>
  )
}

function OriginalArt(props) {
  return (
    <svg viewBox="0 0 52 30" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true" {...props}>
      <circle className="cover-or-not__art-one" cx="15" cy="15" r="12" />
      <circle cx="15" cy="15" r="3" fill="currentColor" stroke="none" />
    </svg>
  )
}

const CHOICES = [
  { value: 'cover', label: "It's a cover", sub: 'Someone recorded it first', Art: CoverArt },
  { value: 'original', label: "It's original", sub: 'This is the first version', Art: OriginalArt },
]

export default function CoverOrNot() {
  const { user, profile } = useAuth()
  const { markComplete, isComplete, completions } = useCompletion(user?.id)
  const [searchParams] = useSearchParams()
  const dateParam = searchParams.get('date') || undefined
  const puzzleDate = dateParam || todayEST()

  // Seeded from the session cache the home screen warmed, so a tapped tile
  // paints the real screen immediately instead of an empty shell.
  const cachedPuzzle = getCachedPuzzle('cover-or-not', dateParam)
  const [puzzle, setPuzzle] = useState(cachedPuzzle)
  const [loading, setLoading] = useState(!cachedPuzzle)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [justFinished, setJustFinished] = useState(false)
  const [chosen, setChosen] = useState(null)
  const [correct, setCorrect] = useState(false)
  const [finalTime, setFinalTime] = useState(null)
  const [originalResultArtwork, setOriginalResultArtwork] = useState(null)
  const [shouldAutoplayOriginal, setShouldAutoplayOriginal] = useState(false)
  const coverRef = useRef(null)
  const originalRef = useRef(null)
  const revealRef = useRef(0)

  const { stop, display } = useGameTimer(!done, 250, `tempify_game_cover-or-not_${puzzleDate}`)

  useEffect(() => {
    // Already seeded from cache, since refetching would only re-run derived
    // state (option order) and make the screen jump.
    if (cachedPuzzle) return
    getPuzzle('cover-or-not', dateParam)
      .then(setPuzzle)
      .catch(() => setError('No puzzle found for today.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    // A pick still in its beat reveals itself when the beat is over.
    if (!puzzle || done || chosen) return
    if (isComplete('cover-or-not', puzzleDate)) {
      stop()
      setCorrect(completions[`cover-or-not|${puzzleDate}`]?.completed ?? false)
      setShouldAutoplayOriginal(false)
      setDone(true)
    }
  }, [puzzle, completions])

  useEffect(() => () => clearTimeout(revealRef.current), [])

  useEffect(() => {
    if (!puzzle) return

    let cancelled = false
    const metadata = puzzle.metadata || {}
    const existing = metadata.original_artwork_url || null
    if (existing) {
      setOriginalResultArtwork(existing)
      prefetchArtworkUrls([existing])
      return
    }

    if (puzzle.answer !== 'cover') return
    if (!metadata.original_title) return

    findArtwork({ title: metadata.original_title, artist: metadata.original_artist })
      .then((url) => {
        if (!cancelled && url) {
          setOriginalResultArtwork(url)
          prefetchArtworkUrls([url])
        }
      })
      .catch(() => {
        // Keep fallback UI if lookup fails.
      })

    return () => { cancelled = true }
  }, [puzzle])

  useEffect(() => {
    if (!done || !shouldAutoplayOriginal) return
    const id = setTimeout(() => {
      originalRef.current?.play()
      setShouldAutoplayOriginal(false)
    }, 100)
    return () => clearTimeout(id)
  }, [done, shouldAutoplayOriginal])

  async function handleGuess(pick) {
    if (done || chosen) return
    hapticImportantTap()
    const elapsed = stop()
    setFinalTime(elapsed)
    const isCorrect = pick === puzzle.answer
    setChosen(pick)
    setCorrect(isCorrect)
    // Recorded at the tap rather than after the beat, so leaving during it
    // can't lose the answer.
    markComplete('cover-or-not', puzzleDate, 1, isCorrect)
    revealRef.current = setTimeout(() => {
      // The cover gives way to the original as the answer lands, so the two
      // can be heard one after the other.
      if (puzzle.answer === 'cover' && puzzle.metadata?.original_audio_url) {
        coverRef.current?.pause()
        setShouldAutoplayOriginal(true)
      }
      setDone(true)
      setJustFinished(true)
    }, lockInDelay())
    if (user) {
      try {
        await saveScore({ userId: user.id, gameSlug: 'cover-or-not', puzzleDate, attempts: 1, completed: isCorrect, timeSeconds: profile?.competitive_mode !== false ? elapsed : null })
        if (isCorrect) await updateStreak(user.id, 'cover-or-not', profile?.is_subscribed)
      } catch (err) {
        console.error('[Tempify] CoverOrNot score save error:', err.message)
      }
    }
  }

  if (loading) return <GameShell><DelayedSpinner active={loading} label="Loading puzzle..." /></GameShell>
  if (error) return <GameShell><p style={{ color: 'var(--text-muted)' }}>{error}</p></GameShell>
  if (!puzzle) return null

  const m = puzzle.metadata || {}
  const isCover = puzzle.answer === 'cover'

  return (
    <GameShell>
      <Link to={exitTarget(searchParams)} replace className="game-back-link tap-target"><Icon name="chevronLeft" size={14} />Back</Link>

      <GameHeader
        slug="cover-or-not"
        name="cover or not"
        date={fmtDayShort(puzzleDate)}
        title="Is this song a cover of an earlier track?"
        timer={!done && profile?.competitive_mode !== false ? { text: display, running: !chosen } : null}
      />

      <AudioPlayer
        ref={coverRef}
        variant="stage"
        visual="rings"
        src={puzzle.audio_url}
        onPlay={() => originalRef.current?.pause()}
        autoplay={profile?.autoplay_audio !== false}
      >
        <StageSong
          title={m.song_title}
          artist={m.song_artist}
          meta={m.song_year}
          src={m.artwork_url || m.song_artwork_url}
        />
      </AudioPlayer>

      <div className="choices">
        {CHOICES.map(({ value, label, sub, Art }, i) => {
          let mod = ''
          let mark = null
          if (done) {
            if (value === puzzle.answer) { mod = ' choice--correct'; mark = 'check' }
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
          answer={isCover
            ? `It's a cover${m.original_title ? ` of "${m.original_title}"` : ''}${m.original_artist ? ` by ${m.original_artist}` : ''}`
            : "It's an original"
          }
          artwork={isCover ? {
            title: m.original_title,
            artist: m.original_artist,
            src: originalResultArtwork || m.original_artwork_url,
          } : undefined}
          detail={m.note || undefined}
          gameSlug="cover-or-not"
          puzzleDate={dateParam}
          timeSeconds={profile?.competitive_mode !== false ? finalTime : null}
          nextGame={{ path: '/', label: 'Back to games' }}
          showLeaderboard={profile?.competitive_mode !== false}
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

function GameShell({ children }) {
  return <div className="page-shell page-shell--fill game-theme--cover-or-not">{children}</div>
}
