// What a challenge link's preview says. Every /game/<slug> page already names
// its game (scripts/game-pages.js); a link that carries a score says whose it
// is and what to beat, the way the share message does:
//
//   /game/hit-or-miss?date=2026-11-02&vs=868.394.0.702.116&by=jett_n
//   "jett_n scored 2,080 of 5,000 on Hit or Miss #189"  "Can you beat it?"
//
// A game a player made (src/lib/customGames.js) has no day, and names its
// maker in m=:
//
//   /game/era?c=3f9a01b2ce&m=dana&vs=1000.500.0.1000&by=sam
//   "sam scored 2,500 of 4,000 on dana's Era"  "Can you beat it? Put the songs..."
//
// The link formats are src/lib/challenge.js's and src/lib/customGames.js's.

const GAMES = {
  'one-bar': 'One Bar',
  'hit-or-miss': 'Hit or Miss',
  era: 'Era',
  'cover-or-not': 'Cover or Not',
  tempo: 'Tap the Tempo',
  sampled: 'Sampled',
}

// Day #1, as in src/lib/date.js.
const FIRST_DAY = Date.UTC(2026, 3, 28)
const ROUND_MAX = 1000
const MAX_GUESSES = 6
// The app cuts a name to this when it reads the link; so does the preview, so
// a hand-made link can't fill it.
const MAX_NAME = 24

function dayLabel(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return ''
  const [y, m, d] = date.split('-').map(Number)
  const n = Math.round((Date.UTC(y, m - 1, d) - FIRST_DAY) / 86400000) + 1
  return n >= 1 ? ` #${n.toLocaleString('en-US')}` : ''
}

// What a made game asks. The game page's own line would be wrong about it:
// Era's says five songs, and a made one can have three.
const MADE_LINES = {
  era: 'Put the songs in order, oldest to newest.',
  'hit-or-miss': 'Guess how high each song got on the Hot 100.',
  'one-bar': 'Name the song from half a second of it.',
}

/**
 * { title, description, url } for a game link, or null to leave the page as
 * it is. `replace` means the description stands in for the page's own,
 * rather than going ahead of it.
 */
export function previewFor(url) {
  const slug = url.pathname.match(/^\/game\/([a-z-]+)\/?$/)?.[1]
  const game = GAMES[slug]
  if (!game) return null
  const params = url.searchParams
  const link = `https://tempify.me${url.pathname}${url.search}`
  const vs = params.get('vs')

  const made = /^[a-f0-9]{10}$/.test(params.get('c') || '') ? MADE_LINES[slug] : null
  const maker = made ? (params.get('m') || '').trim().slice(0, MAX_NAME) : ''
  const day = made ? '' : dayLabel(params.get('date'))
  // How the game is named in a sentence: "Era #189", or "dana's Era".
  const called = made ? `${maker || 'A friend'}'s ${game}` : `${game}${day}`
  const ask = (line) => (made ? { description: `${line} ${made}`, replace: true } : { description: line })

  if (!vs) {
    if (made) return { title: `${called} on Tempify`, description: made, replace: true, url: link }
    return day ? { title: `${called} on Tempify`, url: link } : null
  }

  const name = (params.get('by') || '').trim().slice(0, MAX_NAME) || 'A friend'

  if (slug === 'one-bar') {
    const guesses = Number(vs)
    if (!Number.isInteger(guesses) || guesses < 0 || guesses > MAX_GUESSES) return null
    return guesses === 0
      ? { title: `${name} couldn't name ${called}`, ...ask('Can you?'), url: link }
      : {
          title: `${name} got ${called} in ${guesses} ${guesses === 1 ? 'guess' : 'guesses'}`,
          ...ask('Can you beat it?'),
          url: link,
        }
  }

  const points = vs.split('.').map(Number)
  if (points.some(p => !Number.isInteger(p) || p < 0 || p > ROUND_MAX)) return null
  const total = points.reduce((sum, p) => sum + p, 0)
  const most = points.length * ROUND_MAX
  return {
    title: `${name} scored ${total.toLocaleString('en-US')} of ${most.toLocaleString('en-US')} on ${called}`,
    ...ask('Can you beat it?'),
    url: link,
  }
}
