import { GAMES } from '../lib/games'
import './StreakDisplay.css'

export default function StreakDisplay({ streaks = [] }) {
  const streakMap = {}
  streaks.forEach((s) => {
    streakMap[s.game_slug] = s.current_streak
  })

  return (
    <div className="streak-row">
      {GAMES.map((game) => {
        const streak = streakMap[game.slug] || 0
        return (
          <div key={game.slug} className={`streak-card game-theme--${game.slug}`}>
            <div className={`streak-card__value${streak > 0 ? ' streak-card__value--active' : ''}`}>
              {streak}
            </div>
            <div className="streak-card__label">{game.name}</div>
          </div>
        )
      })}
    </div>
  )
}
