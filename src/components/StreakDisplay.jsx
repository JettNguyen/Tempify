const GAMES = [
  { slug: 'one-bar', name: 'One Bar' },
  { slug: 'drop-or-flop', name: 'Drop or Flop' },
  { slug: 'who-sampled-it', name: 'Who Sampled It' },
  { slug: 'era', name: 'Era' },
  { slug: 'the-flip', name: 'The Flip' },
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
          <div key={game.slug} style={{
            padding: '0.75rem 1rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              {game.name}
            </div>
            <div style={{
              fontSize: '22px',
              fontWeight: 500,
              color: streak > 0 ? 'var(--amber)' : 'var(--text-dim)',
              lineHeight: 1,
            }}>
              {streak}
            </div>
          </div>
        )
      })}
    </div>
  )
}
