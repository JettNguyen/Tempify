import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import GameTile from '../components/GameTile'

const GAMES = [
  {
    slug: 'one-bar',
    name: 'One Bar',
    description: 'Name the song from a tiny clip. Wrong guesses unlock more audio.',
    path: '/game/one-bar',
    featured: true,
  },
  {
    slug: 'drop-or-flop',
    name: 'Drop or Flop',
    description: 'Did it chart? One listen, one guess.',
    path: '/game/drop-or-flop',
  },
  {
    slug: 'who-sampled-it',
    name: 'Who Sampled It',
    description: 'Hear the sample, find the source.',
    path: '/game/who-sampled-it',
  },
  {
    slug: 'era',
    name: 'Era',
    description: 'Guess which decade the song is from.',
    path: '/game/era',
  },
  {
    slug: 'the-flip',
    name: 'The Flip',
    description: 'Two versions of the same song. Which came first?',
    path: '/game/the-flip',
  },
]

const dateLabel = () => {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export default function Home() {
  const { user } = useAuth()
  const { isComplete } = useCompletion(user?.id)

  const [featured, ...rest] = GAMES
  const middle = rest.slice(0, 2)
  const bottom = rest.slice(2)

  return (
    <div style={{
      maxWidth: '680px',
      margin: '0 auto',
      padding: '88px 1.25rem 4rem',
    }}>
      <div style={{ marginBottom: '2rem' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
          {dateLabel()}
        </p>
        <h1 style={{
          fontSize: '22px',
          fontWeight: 500,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
        }}>
          Today's games
        </h1>
      </div>

      {/* Featured tile */}
      <div style={{ marginBottom: '0.75rem' }}>
        <GameTile
          name={featured.name}
          description={featured.description}
          path={featured.path}
          complete={isComplete(featured.slug)}
          featured
        />
      </div>

      {/* 2-column middle row — stacks to 1-col on mobile */}
      <div className="home-grid-mid">
        {middle.map((game) => (
          <GameTile
            key={game.slug}
            name={game.name}
            description={game.description}
            path={game.path}
            complete={isComplete(game.slug)}
          />
        ))}
      </div>

      {/* Bottom row: 60/40 split — stacks to 1-col on mobile */}
      <div className="home-grid-bot">
        {bottom.map((game) => (
          <GameTile
            key={game.slug}
            name={game.name}
            description={game.description}
            path={game.path}
            complete={isComplete(game.slug)}
          />
        ))}
      </div>

      {!user && (
        <p style={{
          marginTop: '2.5rem',
          fontSize: '13px',
          color: 'var(--text-dim)',
          textAlign: 'center',
        }}>
          <Link to="/login" style={{ color: 'var(--text-muted)' }}>Log in</Link> to track streaks and access the archive.
        </p>
      )}
    </div>
  )
}
