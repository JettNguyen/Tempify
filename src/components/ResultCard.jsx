import { Link } from 'react-router-dom'
import ShareButton from './ShareButton'
import TrackArtwork from './TrackArtwork'
import Leaderboard from './Leaderboard'
import './ResultCard.css'

function fmtTime(s) {
  if (s == null) return null
  const mins = Math.floor(s / 60)
  const secs = Math.floor(s % 60)
  const tenths = Math.floor((s % 1) * 10)
  return mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}.${tenths}s`
}

export default function ResultCard({
  correct, answer, artist, detail, emojiGrid,
  gameSlug, nextGame, artwork, children,
  puzzleDate, timeSeconds,
}) {
  const timeLabel = gameSlug !== 'one-bar' ? fmtTime(timeSeconds) : null

  return (
    <div className={`result-card slide-up${correct ? ' result-card--correct' : ''}`}>
      <div className={`result-card__status${correct ? ' result-card__status--correct' : ''}`}>
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
        <ShareButton emojiGrid={emojiGrid} gameSlug={gameSlug} />
        {nextGame && (
          <Link to={nextGame.path} className="result-card__next btn-press btn-amber">
            {nextGame.label} →
          </Link>
        )}
      </div>

      {gameSlug && <Leaderboard gameSlug={gameSlug} puzzleDate={puzzleDate} />}
    </div>
  )
}
