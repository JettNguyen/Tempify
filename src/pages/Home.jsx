import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompletion } from '../hooks/useCompletion'
import { supabase } from '../lib/supabase'
import { todayEST } from '../lib/date'
import GameTile from '../components/GameTile'

const GAMES = [
  { slug: 'one-bar',       name: 'One Bar',         description: 'Name the song from a tiny clip. Wrong guesses unlock more audio.', path: '/game/one-bar',       featured: true },
  { slug: 'drop-or-flop',  name: 'Drop or Flop',    description: 'Did it chart? One listen, one guess.',                             path: '/game/drop-or-flop' },
  { slug: 'who-sampled-it',name: 'Who Sampled It',  description: 'Hear the sample, find the source.',                               path: '/game/who-sampled-it' },
  { slug: 'era',           name: 'Era',              description: 'Guess which decade the song is from.',                            path: '/game/era' },
  { slug: 'the-flip',      name: 'The Flip',         description: 'Two versions of the same song. Which came first?',               path: '/game/the-flip' },
]

const dateLabel = () =>
  new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' })

export default function Home() {
  const { user } = useAuth()
  const { isComplete } = useCompletion(user?.id)
  const [genres, setGenres] = useState({})

  // Prefetch today's puzzle genres so tiles can show the label without navigating in
  useEffect(() => {
    const today = todayEST()
    supabase
      .from('puzzles')
      .select('game_slug, genre')
      .eq('scheduled_date', today)
      .then(({ data }) => {
        if (!data) return
        const map = {}
        data.forEach((p) => { if (p.genre) map[p.game_slug] = p.genre })
        setGenres(map)
      })
  }, [])

  const [featured, ...rest] = GAMES
  const middle = rest.slice(0, 2)
  const bottom = rest.slice(2)

  return (
    <div className="page-shell-wide">
      <div style={{ marginBottom: '2rem' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
          {dateLabel()}
        </p>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Today's games
        </h1>
      </div>

      <div style={{ marginBottom: '0.75rem' }}>
        <GameTile
          name={featured.name}
          description={featured.description}
          path={featured.path}
          complete={isComplete(featured.slug)}
          genre={genres[featured.slug]}
          featured
        />
      </div>

      <div className="home-grid-mid">
        {middle.map((game) => (
          <GameTile
            key={game.slug}
            name={game.name}
            description={game.description}
            path={game.path}
            complete={isComplete(game.slug)}
            genre={genres[game.slug]}
          />
        ))}
      </div>

      <div className="home-grid-bot">
        {bottom.map((game) => (
          <GameTile
            key={game.slug}
            name={game.name}
            description={game.description}
            path={game.path}
            complete={isComplete(game.slug)}
            genre={genres[game.slug]}
          />
        ))}
      </div>

      {!user && (
        <p style={{ marginTop: '2.5rem', fontSize: '13px', color: 'var(--text-dim)', textAlign: 'center' }}>
          <Link to="/login" style={{ color: 'var(--text-muted)' }}>Log in</Link> to track streaks and access the archive.
        </p>
      )}
    </div>
  )
}
