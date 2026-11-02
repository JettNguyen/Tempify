// What a challenge link's preview says. Every /game/<slug> page already names
// its game (scripts/game-pages.js); a link that carries a score says whose it
// is and what to beat, the way the share message does:
//
//   /game/hit-or-miss?date=2026-11-02&vs=868.394.0.702.116&by=jett_n
//   "jett_n scored 2,080 of 5,000 on Hit or Miss #189"  "Can you beat it?"
//
// The link formats are src/lib/challenge.js's.

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

/** { title, description, url } for a game link, or null to leave the page as it is. */
export function previewFor(url) {
  const slug = url.pathname.match(/^\/game\/([a-z-]+)\/?$/)?.[1]
  const game = GAMES[slug]
  if (!game) return null
  const params = url.searchParams
  const day = dayLabel(params.get('date'))
  const link = `https://tempify.me${url.pathname}${url.search}`
  const vs = params.get('vs')

  if (!vs) return day ? { title: `${game}${day} on Tempify`, url: link } : null

  const name = (params.get('by') || '').trim().slice(0, MAX_NAME) || 'A friend'

  if (slug === 'one-bar') {
    const guesses = Number(vs)
    if (!Number.isInteger(guesses) || guesses < 0 || guesses > MAX_GUESSES) return null
    return guesses === 0
      ? { title: `${name} couldn't name One Bar${day}`, description: 'Can you?', url: link }
      : {
          title: `${name} got One Bar${day} in ${guesses} ${guesses === 1 ? 'guess' : 'guesses'}`,
          description: 'Can you beat it?',
          url: link,
        }
  }

  const points = vs.split('.').map(Number)
  if (points.some(p => !Number.isInteger(p) || p < 0 || p > ROUND_MAX)) return null
  const total = points.reduce((sum, p) => sum + p, 0)
  const most = points.length * ROUND_MAX
  return {
    title: `${name} scored ${total.toLocaleString('en-US')} of ${most.toLocaleString('en-US')} on ${game}${day}`,
    description: 'Can you beat it?',
    url: link,
  }
}
