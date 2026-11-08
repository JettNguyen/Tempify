import { previewFor } from './preview.js'

// Runs on tempify.me/game/* in front of GitHub Pages. It passes every page
// through and, for a link that carries a score or a day, rewrites the preview
// tags to say so. Nothing else in the page changes.
//
// A Worker's request to its own zone goes straight to the origin, so in
// production it just fetches the request. ORIGIN points it somewhere else to
// try it locally (wrangler dev --var ORIGIN:http://127.0.0.1:4791).

function setContent(content) {
  return { element(el) { el.setAttribute('content', content) } }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const upstream = env.ORIGIN ? new Request(new URL(url.pathname + url.search, env.ORIGIN), request) : request
    const response = await fetch(upstream)

    const preview = previewFor(url)
    if (!preview || !(response.headers.get('content-type') || '').includes('text/html')) return response

    let rewriter = new HTMLRewriter()
      .on('meta[property="og:title"]', setContent(preview.title))
      .on('meta[property="og:url"]', setContent(preview.url))
    if (preview.description) {
      // Ahead of the game's own line, which stays: "Can you beat it? How high
      // did five songs chart on the Hot 100?" A made game's replaces it.
      rewriter = rewriter.on('meta[property="og:description"]', {
        element(el) {
          const own = preview.replace ? '' : el.getAttribute('content') || ''
          el.setAttribute('content', `${preview.description} ${own}`.trim())
        },
      })
    }
    return rewriter.transform(response)
  },
}
