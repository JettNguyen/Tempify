import GameGlyph from './GameGlyph'
import { fmtDayShort, fmtDayNumber } from '../lib/date'

/**
 * The top of every game: which game it is, in its own colour with its symbol
 * from the home screen, the question, and the clock when the clock is on.
 *
 * @param timer null for no clock, or { text, running }. A clock that hasn't
 *              started says how it will.
 */
export default function GameHeader({ slug, name, puzzleDate, title, timer }) {
  const number = fmtDayNumber(puzzleDate)
  return (
    <div className="game-header">
      <div className="game-header__top">
        <p className="game-header__eyebrow">
          <GameGlyph slug={slug} className="game-header__glyph" />
          <span className="game-header__name">{name}</span>
          <span className="puzzle-date">{fmtDayShort(puzzleDate)}</span>
          {number && <span className="puzzle-date puzzle-number">{number}</span>}
        </p>
        {timer && (
          <p className={`game-timer${timer.running ? ' game-timer--running' : ''}${timer.idle ? ' game-timer--idle' : ''}`}>
            <span className="game-timer__dot" aria-hidden="true" />
            {timer.text}
          </p>
        )}
      </div>
      <h1 className="game-header__title">{title}</h1>
    </div>
  )
}
