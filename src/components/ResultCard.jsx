import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ShareButton from './ShareButton'
import TrackArtwork from './TrackArtwork'
import Icon from './Icon'
import Leaderboard from './Leaderboard'
import { hapticWinCelebration, hapticFailure } from '../lib/haptics'
import { fmtTime } from '../lib/date'
import './ResultCard.css'

export default function ResultCard({
  correct, answer, artist, detail, emojiGrid,
  gameSlug, nextGame, artwork, children,
  puzzleDate, timeSeconds, attempts, showLeaderboard, justFinished,
}) {
  const [searchParams] = useSearchParams()
  const dateParam = searchParams.get('date')

  // When playing an archive date, preserve it through the next-game chain.
  // If the final destination is "/" (CoverOrNot's "Back to games"), send to
  // the archive day instead so the user lands back on that day's list.
  function resolveNextPath(path) {
    if (!dateParam) return path
    if (path === '/') return `/archive/${dateParam}`
    return `${path}?date=${dateParam}`
  }

  const timeLabel = gameSlug !== 'one-bar' ? fmtTime(timeSeconds) : null

  // Only on a fresh finish — revisiting a played puzzle shouldn't buzz again.
  useEffect(() => {
    if (!justFinished) return
    if (correct) hapticWinCelebration()
    else hapticFailure()
  }, [justFinished, correct])

  return (
    <div className={`result-card slide-up${correct ? ' result-card--correct' : ''}`}>
      <div className={`result-card__status${correct ? ' result-card__status--correct' : ''}`}>
        <Icon name={correct ? 'check' : 'x'} size={15} strokeWidth={2.25} />
        {correct ? 'Correct' : 'Not quite'}
        {timeLabel && <span className="result-card__time"> · {timeLabel}</span>}
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
        {nextGame && (
          <Link to={resolveNextPath(nextGame.path)} replace className="result-card__next btn-press btn-amber">
            {nextGame.label} →
          </Link>
        )}
      </div>

      {gameSlug && showLeaderboard !== false && <Leaderboard gameSlug={gameSlug} puzzleDate={puzzleDate} />}
    </div>
  )
}
