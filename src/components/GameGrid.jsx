import GameTile from './GameTile'
import './GameGrid.css'

/**
 * Bento layout for a day's games: a tall hero on the left with a stack beside
 * it, then any remainder in full rows. The lineup length changes as games come
 * and go, and archive days carry retired games, so the shape is derived rather
 * than hard-coded.
 */
export default function GameGrid({ games }) {
  if (!games || games.length === 0) return null

  const [hero, ...rest] = games
  // The hero only stretches when there are two tiles to stack against it,
  // otherwise it would tower over a half-empty column.
  const isTall = rest.length >= 2
  const side = isTall ? rest.slice(0, 2) : rest
  const tail = isTall ? rest.slice(2) : []

  const heroClass = [
    'game-grid__item',
    rest.length === 0 ? 'game-grid__item--wide' : '',
    isTall ? 'game-grid__item--tall' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="game-grid">
      <GameTile key={hero.slug} {...hero} featured className={heroClass} />

      {side.map((game) => (
        <GameTile key={game.slug} {...game} className="game-grid__item" />
      ))}

      {tail.map((game, i) => (
        <GameTile
          key={game.slug}
          {...game}
          // An odd tail would leave the last tile stranded beside a gap.
          className={`game-grid__item${i === tail.length - 1 && tail.length % 2 === 1 ? ' game-grid__item--wide' : ''}`}
        />
      ))}
    </div>
  )
}
