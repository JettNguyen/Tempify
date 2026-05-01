const prefetched = new Set()

function normalizeUrl(url) {
  return typeof url === 'string' ? url.trim() : ''
}

const APPLE_ARTWORK_SIZE_RE = /(\/)(\d+)x(\d+)bb(?=([./?]|$))/

export function optimizeArtworkUrl(rawUrl, size = 'medium') {
  const url = normalizeUrl(rawUrl)
  if (!url) return ''

  const targetPixels = size === 'small' ? 120 : 240
  if (!url.includes('mzstatic.com')) return url

  if (APPLE_ARTWORK_SIZE_RE.test(url)) {
    return url.replace(APPLE_ARTWORK_SIZE_RE, `$1${targetPixels}x${targetPixels}bb`)
  }

  return url
}

function collectArtworkUrls(value, urls) {
  if (!value) return

  if (Array.isArray(value)) {
    value.forEach((item) => collectArtworkUrls(item, urls))
    return
  }

  if (typeof value !== 'object') return

  Object.entries(value).forEach(([key, nestedValue]) => {
    if (/_artwork_url$/i.test(key) || key === 'artwork_url') {
      const url = normalizeUrl(nestedValue)
      if (url) urls.add(url)
      return
    }
    collectArtworkUrls(nestedValue, urls)
  })
}

export function getPuzzleArtworkUrls(puzzle) {
  if (!puzzle) return []
  const urls = new Set()

  collectArtworkUrls(puzzle.metadata, urls)

  return Array.from(urls)
}

export function prefetchArtworkUrls(urls = []) {
  if (typeof Image === 'undefined') return

  urls.forEach((rawUrl) => {
    const url = optimizeArtworkUrl(rawUrl, 'medium')
    if (!url || prefetched.has(url)) return
    prefetched.add(url)

    const img = new Image()
    img.decoding = 'async'
    img.src = url
  })
}
