import './StreakDisplay.css'

const GAMES = [
  { slug: 'one-bar', name: 'One Bar' },
  { slug: 'hit-or-miss', name: 'Hit or Miss' },
  { slug: 'sampled', name: 'Sampled' },
  { slug: 'era', name: 'Era' },
  { slug: 'cover-or-not', name: 'Cover or Not' },
]

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
          <div key={game.slug} className="streak-card">
            <div className="streak-card__label">{game.name}</div>
            <div className={`streak-card__value${streak > 0 ? ' streak-card__value--active' : ''}`}>
              {streak}
            </div>
          </div>
        )
      })}
    </div>
  )
}
