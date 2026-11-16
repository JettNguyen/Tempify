// A tempify.me link tapped on an iPhone with the app on it opens the app
// (public/.well-known/apple-app-site-association says which pages, and the
// app's associated domains entitlement claims the site). The link arrives as
// a whole address; the app wants the page inside it.

const HOSTS = new Set(['tempify.me', 'www.tempify.me'])

/** The in-app path for a tempify.me link ("/game/era?date=...&vs=..."), or null for any other address. */
export function appPathFor(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || !HOSTS.has(url.hostname)) return null
  return `${url.pathname || '/'}${url.search}${url.hash}`
}
