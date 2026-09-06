// Explore's browse cards and an archive day's tiles produce the same
// /game/<slug>?date=<date> URL, so the game itself can't otherwise tell which
// one sent the player here. Explore tags its links, and both the back link and
// the post-game action follow that tag home.
export const EXPLORE_ORIGIN = 'explore'

export function cameFromExplore(fromParam) {
  return fromParam === EXPLORE_ORIGIN
}

// Someone who picked one puzzle out of Explore didn't ask for that day's
// rotation, so send them back to the shelf they pulled it off, filters and all.
// Takes the whole search string so the return trip can carry more than the date
// without every game having to know what is in it.
export function exitTarget(params) {
  if (cameFromExplore(params.get('from'))) {
    const genres = params.get('genres')
    return genres ? `/explore?genres=${encodeURIComponent(genres)}` : '/explore'
  }
  const date = params.get('date')
  return date ? `/archive/${date}` : '/'
}

// Carries an archive date through the next-game chain. Cover or Not ends the
// chain at "/" ("Back to games"), which on an archive date should mean that
// day's list rather than today's home screen.
function nextPath(path, dateParam) {
  if (!dateParam) return path
  if (path === '/') return `/archive/${dateParam}`
  return `${path}?date=${dateParam}`
}

// The button under a finished puzzle. Picking a single puzzle out of Explore is
// a deliberate choice of that one puzzle, so the chain into the rest of the
// day's rotation isn't what's wanted, so offer the way back to browsing instead.
export function resultAction(nextGame, params) {
  if (cameFromExplore(params.get('from'))) {
    return { to: exitTarget(params), label: '← Back to Explore' }
  }
  if (!nextGame) return null
  return { to: nextPath(nextGame.path, params.get('date')), label: `${nextGame.label} →` }
}
