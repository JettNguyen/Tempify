import { Link } from 'react-router-dom'
import { GENRE_COLORS } from '../lib/genres'
import GameGlyph from './GameGlyph'
import './GameTile.css'

export default function GameTile({ slug, name, description, path, complete, featured, genre, className = '' }) {
  const genreStyle = genre && GENRE_COLORS[genre]

  return (
    <Link
      to={path}
      className={`game-tile card-hover btn-press game-theme--${slug}${featured ? ' game-tile--featured' : ''}${className ? ` ${className}` : ''}`}
    >
      <GameGlyph slug={slug} className="game-tile__glyph" />

      <div className="game-tile__header">
        <div className="game-tile__body">
          <div className="game-tile__name">{name}</div>
          <div className="game-tile__description">{description}</div>
        </div>

        <span
          className={`game-tile__dot${complete ? ' game-tile__dot--complete' : ' dot-pulse'}`}
          title={complete ? 'Completed today' : 'Not played yet'}
          aria-label={complete ? 'Completed today' : 'Not played yet'}
        >
          {complete ? '✓' : null}
        </span>
      </div>

      <div className="game-tile__footer">
        <span className={`game-tile__play-badge btn-press${complete ? ' game-tile__play-badge--complete' : ''}`}>
          {complete ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
              <path d="M1 1L9 5L1 9V1Z"/>
            </svg>
          )}
          {complete ? 'Admire' : 'Play'}
        </span>

        {genreStyle && (
          <span
            className="game-tile__genre-pill"
            style={{ background: genreStyle.bg, color: genreStyle.text }}
          >
            {genre}
          </span>
        )}
      </div>
    </Link>
  )
}
