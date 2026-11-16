// How far back a swipe can go in the iPhone app.
//
// The app's swipe from the left edge is the web view's own back gesture, and
// the web view keeps an entry, with a picture of the page for the swipe to
// show, for every page ever opened. Left alone, an app open for a week could
// be swiped back through a week of pages. A web view's history can't be
// trimmed directly, but going back and then replacing the page landed on
// drops what was ahead of it the next time a page opens, so the app does that
// at two points:
//
// - A tab (Home, Explore, your profile, Admin) is a fresh start, the way a
//   native app's tabs are: opening one goes back to the first entry and puts
//   the tab there, so there's nothing behind it to swipe to. That includes a
//   page swapped for a tab: a game's Back link replaces the game with Home,
//   which left one more Home behind every game played.
// - Past MAX_DEPTH pages deep, a new page takes the place of the one before
//   it rather than stacking on top.

export const MAX_DEPTH = 12

const TAB_PATHS = new Set(['/', '/explore', '/profile', '/admin'])

/** Whether a path is one of the tabs. `ownProfile` is the player's own /u/ page, which the navbar opens as one. */
export function isTabPath(pathname, ownProfile = null) {
  return TAB_PATHS.has(pathname) || (Boolean(ownProfile) && pathname === ownProfile)
}

/**
 * How many entries to go back before putting a page just opened in place, or
 * 0 to leave it where it is. `index` is its place in the history, 0 for the
 * first. `replaced` is true when it took the place of the page before rather
 * than stacking on it, which can't make the history any deeper. Never for a
 * swipe back.
 */
export function stepsBack(pathname, index, ownProfile = null, replaced = false) {
  if (!Number.isInteger(index) || index <= 0) return 0
  if (isTabPath(pathname, ownProfile)) return index
  if (!replaced && index > MAX_DEPTH) return 1
  return 0
}
