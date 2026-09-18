import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import ShareButton from './ShareButton'
import TrackArtwork from './TrackArtwork'
import Icon from './Icon'
import Leaderboard from './Leaderboard'
import PuzzleStats from './PuzzleStats'
import { hapticWinCelebration, hapticFailure } from '../lib/haptics'
import { resultAction } from '../lib/gameExit'
import { fmtTime } from '../lib/date'
import './ResultCard.css'
import './ResultOverlay.css'

// A win throws more, further, in more colours. A loss still gets a burst, since
// the point is that the round ended, not that you were wrong, but a quieter one.
const WIN_SPARKS = 20
const LOSS_SPARKS = 10
// Far enough out to clear the card. A spark that dies behind the panel was
// never seen, and the panel is 440px across at its widest.
const WIN_SPREAD = 430
const LOSS_SPREAD = 330

/** Stable per-spark jitter, so a re-render mid-flight can't redirect any of them. */
function scatter(i, salt) {
  const x = Math.sin((i + 1) * salt) * 10000
  return x - Math.floor(x)
}

/**
 * The burst, as plain numbers the CSS can read off custom properties. Angles
 * are spread evenly around the circle and then nudged, rather than drawn at
 * random: left to chance, half a dozen sparks clump into one direction and the
 * burst comes out looking like a leak.
 */
function burstSparks(count, spread) {
  return Array.from({ length: count }, (_, i) => ({
    angle: (i / count) * 360 + (scatter(i, 12.9898) - 0.5) * (300 / count),
    distance: Math.round(spread * (0.7 + scatter(i, 78.233) * 0.7)),
    size: (4 + scatter(i, 43.7585) * 5).toFixed(1),
    delay: (scatter(i, 91.123) * 0.17).toFixed(3),
    duration: (0.62 + scatter(i, 27.19) * 0.5).toFixed(2),
  }))
}

export default function ResultCard({
  correct, answer, artist, detail, emojiGrid,
  gameSlug, nextGame, artwork, children,
  puzzleDate, timeSeconds, attempts, showLeaderboard, justFinished,
}) {
  const [searchParams] = useSearchParams()
  const action = resultAction(nextGame, searchParams)
  const panelRef = useRef(null)

  const timeLabel = gameSlug !== 'one-bar' ? fmtTime(timeSeconds) : null
  const status = correct ? 'Correct' : 'Not quite'

  // Opens itself on the finish that earned it. Coming back to a puzzle you
  // played days ago, a celebration you have already had would be in the way, so
  // the strip on the page is the whole of it until you ask for more.
  const [open, setOpen] = useState(Boolean(justFinished))
  // And the burst is spent once it has played. Reopening gets the glow and the
  // panel, but not the fanfare a second time.
  const [celebrate, setCelebrate] = useState(Boolean(justFinished))

  const sparks = useMemo(
    () => burstSparks(correct ? WIN_SPARKS : LOSS_SPARKS, correct ? WIN_SPREAD : LOSS_SPREAD),
    [correct],
  )

  // Only on a fresh finish: revisiting a played puzzle shouldn't buzz again.
  useEffect(() => {
    if (!justFinished) return
    if (correct) hapticWinCelebration()
    else hapticFailure()
  }, [justFinished, correct])

  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    // The page behind is a finished puzzle; scrolling it under the result only
    // ever means the result moves when you meant to scroll the result.
    document.body.classList.add('result-open')
    panelRef.current?.focus({ preventScroll: true })
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('result-open')
    }
  }, [open])

  function close() {
    setOpen(false)
    setCelebrate(false)
  }

  const overlay = (
    <div className="result-overlay">
      <div className="result-overlay__scrim" onClick={close} />

      <div
        className={`result-overlay__glow result-overlay__glow--${correct ? 'win' : 'loss'}`}
        aria-hidden="true"
      >
        <span className="result-overlay__ambient" />
        {celebrate && correct && <span className="result-overlay__rays" />}
        <span className="result-overlay__bloom" />
        <span className="result-overlay__bloom result-overlay__bloom--late" />
        {celebrate && (
          <>
            <span className="result-overlay__ring" />
            <span className="result-overlay__ring result-overlay__ring--late" />
            {sparks.map((spark, i) => (
              <span
                key={i}
                className="result-overlay__spark"
                style={{
                  '--a': `${spark.angle}deg`,
                  '--d': `${spark.distance}px`,
                  '--s': `${spark.size}px`,
                  '--delay': `${spark.delay}s`,
                  '--dur': `${spark.duration}s`,
                }}
              />
            ))}
          </>
        )}
      </div>

      <button type="button" className="result-overlay__close btn-press" onClick={close} aria-label="Close results">
        <Icon name="x" size={17} strokeWidth={2.25} />
      </button>

      <div
        ref={panelRef}
        className="result-overlay__panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${status}. ${answer}`}
        tabIndex={-1}
      >
        <div className={`result-card stagger-list${correct ? ' result-card--correct' : ''}`}>
          <div className="result-card__crest">
            <span
              className={`result-card__crest-halo${correct ? ' result-card__crest-halo--correct' : ''}`}
              aria-hidden="true"
            />
            <span className={`result-card__crest-mark${correct ? ' result-card__crest-mark--correct' : ''}`}>
              <Icon name={correct ? 'check' : 'x'} size={21} strokeWidth={2.75} />
            </span>
            <span className="result-card__crest-text">
              <span className={`result-card__crest-label${correct ? ' result-card__crest-label--correct' : ''}`}>
                {status}
              </span>
              {timeLabel && <span className="result-card__crest-time">{timeLabel}</span>}
            </span>
          </div>

          <div className={artwork ? 'result-card__answer-row' : undefined}>
            {artwork && (
              <TrackArtwork title={artwork.title} artist={artwork.artist} src={artwork.src} size="medium" />
            )}
            <div>
              <div className="result-card__answer">{answer}</div>
              {artist && <div className="result-card__artist">{artist}</div>}
            </div>
          </div>

          {detail && <div className="result-card__detail">{detail}</div>}

          {children && <div className="result-card__extra">{children}</div>}

          {emojiGrid && <div className="result-card__emoji">{emojiGrid}</div>}

          <div className="result-card__actions">
            <ShareButton
              emojiGrid={emojiGrid}
              gameSlug={gameSlug}
              correct={correct}
              attempts={attempts}
              timeSeconds={timeSeconds}
              puzzleDate={puzzleDate}
            />
            {action && (
              <Link to={action.to} replace className="result-card__next btn-press btn-amber">
                {action.label}
              </Link>
            )}
          </div>

          {gameSlug && (
            <PuzzleStats
              gameSlug={gameSlug}
              puzzleDate={puzzleDate}
              attempts={attempts}
              timeSeconds={timeSeconds}
              correct={correct}
            />
          )}

          {gameSlug && showLeaderboard !== false && <Leaderboard gameSlug={gameSlug} puzzleDate={puzzleDate} />}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Left on the page whether the overlay is up or not: closing the result
          shouldn't cost you the answer, and this is also the way back in. */}
      <button
        type="button"
        className={`result-stub btn-press${correct ? ' result-stub--correct' : ''}`}
        onClick={() => setOpen(true)}
      >
        <span className={`result-stub__mark${correct ? ' result-stub__mark--correct' : ''}`}>
          <Icon name={correct ? 'check' : 'x'} size={13} strokeWidth={2.75} />
        </span>
        <span className="result-stub__text">
          <span className="result-stub__status">
            {status}{timeLabel ? ` · ${timeLabel}` : ''}
          </span>
          <span className="result-stub__answer">{answer}</span>
        </span>
        <span className="result-stub__cta">
          <span>See results</span>
          <Icon name="chevronRight" size={13} strokeWidth={2.25} />
        </span>
      </button>

      {open && createPortal(overlay, document.body)}
    </>
  )
}
