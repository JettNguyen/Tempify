// A page per game, written beside index.html at build time (game/<slug>.html,
// which GitHub Pages serves at /game/<slug>). Without one, a shared game link
// is answered by 404.html with a 404, which Messages, Discord and the rest show
// as no preview at all. Each copy is the app itself, with the link preview
// naming its game.

export const SITE = 'https://tempify.me'

function attr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/** index.html with its link preview set to one game. */
export function gamePage(html, game) {
  const tags = [
    ['property', 'og:title', `${game.name} on Tempify`],
    ['property', 'og:description', game.description],
    ['property', 'og:url', `${SITE}${game.path}`],
    ['property', 'og:image:alt', `${game.name}, one of Tempify's daily music games`],
    ['name', 'description', `${game.name} on Tempify: ${game.description}`],
  ]
  return tags.reduce((page, [kind, key, value]) => {
    const tag = new RegExp(`(<meta ${kind}="${key}" content=")[^"]*(")`)
    // A renamed tag in index.html should stop the build, not ship a page
    // that quietly previews as the home page.
    if (!tag.test(page)) throw new Error(`game-pages: index.html has no ${key} tag`)
    return page.replace(tag, `$1${attr(value)}$2`)
  }, html)
}

// The app's other fixed addresses. GitHub Pages answered each with 404.html
// and a 404 status, which bounced the visit through /?spa= and told search
// engines (and anyone checking the privacy policy link) that the page was
// missing. A copy of index.html under each name answers with a 200 instead.
// Keep in step with the routes in src/App.jsx.
export const APP_PAGES = ['privacy', 'terms', 'login', 'signup', 'explore', 'profile', 'subscribe', 'success', 'make']

/** index.html with its link preview pointed at one of the app's own pages. */
export function appPage(html, name) {
  const tag = /(<meta property="og:url" content=")[^"]*(")/
  if (!tag.test(html)) throw new Error('game-pages: index.html has no og:url tag')
  return html.replace(tag, `$1${SITE}/${attr(name)}$2`)
}
