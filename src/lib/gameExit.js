// Explore's browse cards and an archive day's tiles produce the same
// /game/<slug>?date=<date> URL, so the game itself can't otherwise tell which
// one sent the player here. Explore tags its links, and both the back link and
// the post-game action follow that tag home.
export const EXPLORE_ORIGIN = 'explore'

export function cameFromExplore(fromParam) {
  return fromParam === EXPLORE_ORIGIN
}

// Someone who picked one puzzle out of Explore didn't ask for that day's
// rotation — send them back to the shelf they pulled it off.
export function exitTarget(dateParam, fromParam) {
  if (cameFromExplore(fromParam)) return '/explore'
  if (dateParam) return `/archive/${dateParam}`
  return '/'
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
// day's rotation isn't what's wanted — offer the way back to browsing instead.
export function resultAction(nextGame, dateParam, fromParam) {
  if (cameFromExplore(fromParam)) return { to: '/explore', label: '← Back to Explore' }
  if (!nextGame) return null
  return { to: nextPath(nextGame.path, dateParam), label: `${nextGame.label} →` }
}
