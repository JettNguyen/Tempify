export const GAMES = [
  { slug: 'one-bar',      name: 'One Bar',      path: '/game/one-bar',      description: 'Name the song from a tiny clip. Wrong guesses unlock more audio.', featured: true },
  { slug: 'hit-or-miss',  name: 'Hit or Miss',  path: '/game/hit-or-miss',  description: 'Did it enter the Hot 100?' },
  { slug: 'sampled',      name: 'Sampled',       path: '/game/sampled',      description: 'Hear the sample, find the source.' },
  { slug: 'era',          name: 'Era',           path: '/game/era',          description: 'Guess which decade the song is from.' },
  { slug: 'cover-or-not', name: 'Cover or Not',  path: '/game/cover-or-not', description: 'Is it a cover of an earlier track?' },
]

export const GAME_SLUGS = GAMES.map(g => g.slug)

export const GAME_BY_SLUG = Object.fromEntries(GAMES.map(g => [g.slug, g]))

export function getGameName(slug) {
  return GAME_BY_SLUG[slug]?.name ?? slug
}
