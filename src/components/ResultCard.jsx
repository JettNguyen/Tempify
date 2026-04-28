import { Link } from 'react-router-dom'
import ShareButton from './ShareButton'

export default function ResultCard({ correct, answer, artist, detail, emojiGrid, gameSlug, nextGame }) {
  return (
    <div className="slide-up" style={{
      marginTop: '1.5rem',
      padding: '1.5rem',
      background: 'var(--surface)',
      border: `1px solid ${correct ? 'var(--green)' : 'var(--border)'}`,
      borderRadius: '10px',
    }}>
      <div style={{
        fontSize: '12px',
        color: correct ? 'var(--green)' : 'var(--text-muted)',
        marginBottom: '0.5rem',
        fontWeight: 500,
      }}>
        {correct ? 'Correct' : 'Not quite'}
      </div>

      <div style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: 500, marginBottom: '2px' }}>
        {answer}
      </div>

      {artist && (
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {artist}
        </div>
      )}

      {detail && (
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          {detail}
        </div>
      )}

      {emojiGrid && (
        <div style={{
          fontFamily: 'monospace',
          fontSize: '18px',
          letterSpacing: '2px',
          marginTop: '1rem',
          marginBottom: '0.25rem',
        }}>
          {emojiGrid}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', alignItems: 'center' }}>
        <ShareButton emojiGrid={emojiGrid} gameSlug={gameSlug} />
        {nextGame && (
          <Link
            to={nextGame.path}
            style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              padding: '7px 14px',
              border: '1px solid var(--border)',
              borderRadius: '999px',
              transition: 'background 80ms ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#222222'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {nextGame.label} →
          </Link>
        )}
      </div>
    </div>
  )
}
