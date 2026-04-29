import { Link } from 'react-router-dom'
import ShareButton from './ShareButton'
import './ResultCard.css'

export default function ResultCard({ correct, answer, artist, detail, emojiGrid, gameSlug, nextGame }) {
  return (
    <div className={`result-card slide-up${correct ? ' result-card--correct' : ''}`}>
      <div className={`result-card__status${correct ? ' result-card__status--correct' : ''}`}>
        {correct ? 'Correct' : 'Not quite'}
      </div>

      <div className="result-card__answer">{answer}</div>

      {artist && <div className="result-card__artist">{artist}</div>}

      {detail && <div className="result-card__detail">{detail}</div>}

      {emojiGrid && <div className="result-card__emoji">{emojiGrid}</div>}

      <div className="result-card__actions">
        <ShareButton emojiGrid={emojiGrid} gameSlug={gameSlug} />
        {nextGame && (
          <Link
            to={nextGame.path}
            className="btn-hover btn-press"
            style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              padding: '7px 14px',
              border: '1px solid var(--border)',
              borderRadius: '999px',
            }}
          >
            {nextGame.label} →
          </Link>
        )}
      </div>
    </div>
  )
}
