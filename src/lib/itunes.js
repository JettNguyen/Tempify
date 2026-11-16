import { remember } from './remember'
import { artworkKey, knownArtwork, keepArtwork } from './artworkLookups'

// In dev, requests go through the Vite proxy (/itunes → itunes.apple.com).
// In production, use a Supabase Functions proxy when VITE_ITUNES_PROXY_URL is set.
// Prefer the public function domain (https://<project>.functions.supabase.co/itunes-proxy).
const PROXY_URL = import.meta.env.VITE_ITUNES_PROXY_URL
  ? import.meta.env.VITE_ITUNES_PROXY_URL.replace(/\/$/, '')
  : null
const BASE = PROXY_URL
  ? PROXY_URL
  : import.meta.env.DEV
    ? '/itunes'
    : 'https://itunes.apple.com'

// Searches made this session, the latest SEARCH_KEEP of them.
const cache = new Map()
const SEARCH_KEEP = 100

function searchSongsViaJsonp(query, limit = 20) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve([])
  }

  return new Promise((resolve) => {
    const callbackName = `__tempify_itunes_${Date.now()}_${Math.floor(Math.random() * 100000)}`
    const script = document.createElement('script')
    const timeout = window.setTimeout(() => cleanup([]), 2200)

    function cleanup(result) {
      try {
        delete window[callbackName]
      } catch {
        window[callbackName] = undefined
      }
      if (script.parentNode) script.parentNode.removeChild(script)
      window.clearTimeout(timeout)
      resolve(result)
    }

    window[callbackName] = (json) => {
      cleanup(Array.isArray(json?.results) ? json.results : [])
    }

    script.onerror = () => cleanup([])

    const url = new URL('https://itunes.apple.com/search')
    url.searchParams.set('term', query)
    url.searchParams.set('entity', 'song')
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('callback', callbackName)
    script.src = url.toString()

    document.head.appendChild(script)
  })
}

// Map iTunes genre names to our curated GENRES list
const GENRE_MAP = {
  'pop':                'Pop',
  'dance':              'Pop',
  'hip-hop/rap':        'Hip-Hop',
  'hip-hop':            'Hip-Hop',
  'rap':                'Hip-Hop',
  'rock':               'Rock',
  'hard rock':          'Rock',
  'classic rock':       'Rock',
  'alternative':        'Indie',
  'indie pop':          'Indie',
  'indie rock':         'Indie',
  'singer/songwriter':  'Folk',
  'folk':               'Folk',
  'acoustic':           'Folk',
  'r&b/soul':           'R&B',
  'r&b':                'R&B',
  'soul':               'R&B',
  'funk':               'R&B',
  'electronic':         'Electronic',
  'edm':                'Electronic',
  'house':              'Electronic',
  'techno':             'Electronic',
  'country':            'Country',
  'jazz':               'Jazz',
  'blues':              'Jazz',
  'metal':              'Metal',
  'heavy metal':        'Metal',
  'latin':              'Latin',
  'reggae':             'Reggae',
  'dancehall':          'Reggae',
}

function mapGenre(itunesGenre) {
  if (!itunesGenre) return null
  return GENRE_MAP[itunesGenre.toLowerCase()] ?? null
}

// Variant suffixes that make the same song look like a different result
const VARIANT_RE = /\s*[([]\s*(feat\.|ft\.|featuring|remix|remixed|remaster|remastered|live|edit|version|radio\s*edit|acoustic|instrumental|deluxe|extended|mix|reprise|cover|tribute|explicit|clean|mono|stereo|single\s*version|original\s*mix|bonus)\b.*[)\]]\s*$/gi

export function stripVariant(title) {
  return title.replace(VARIANT_RE, '').trim()
}

function deduplicate(tracks) {
  const seen = new Map()
  for (const t of tracks) {
    if (!t?.title || !t?.artist) continue
    const key = `${stripVariant(t.title).toLowerCase()}|||${t.artist.toLowerCase()}`
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, t)
    } else {
      // Prefer: has preview > shorter title (fewer variant words) > original order.
      // The shorter title has to win between two that both have a preview too,
      // or "Blinding Lights (Live)" listed first hides the studio recording
      // from findClip, which wants the plain title.
      const betterPreview = !existing.previewUrl && t.previewUrl
      const samePreview = Boolean(existing.previewUrl) === Boolean(t.previewUrl)
      const shorter = t.title.length < existing.title.length
      if (betterPreview || (samePreview && shorter)) {
        seen.set(key, t)
      }
    }
  }
  return Array.from(seen.values())
}

function normalizeForSearch(value) {
  return (value || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function filterByQuery(results, query) {
  const q = normalizeForSearch(query)
  if (!q) return results
  return results.filter((track) => {
    const title = normalizeForSearch(track.title)
    const artist = normalizeForSearch(track.artist)
    return title.includes(q) || artist.includes(q) || `${title} ${artist}`.includes(q)
  })
}

export function getCachedSongSearch(query) {
  const key = (query || '').trim().toLowerCase()
  if (!key) return []
  if (cache.has(key)) return cache.get(key)

  let bestMatchKey = null
  for (const cachedKey of cache.keys()) {
    if (!key.startsWith(cachedKey)) continue
    if (!bestMatchKey || cachedKey.length > bestMatchKey.length) {
      bestMatchKey = cachedKey
    }
  }

  if (!bestMatchKey) return []
  return filterByQuery(cache.get(bestMatchKey) || [], key).slice(0, 8)
}

export async function searchSongs(query) {
  if (!query || query.trim().length < 2) return []

  const key = query.trim().toLowerCase()
  if (cache.has(key)) return cache.get(key)

  // Fetch more than we need so deduplication still leaves enough results
  const url = new URL(`${BASE}/search`)
  url.searchParams.set('term', query)
  url.searchParams.set('media', 'music')
  url.searchParams.set('entity', 'song')
  url.searchParams.set('limit', '20')

  const toTracks = (resultList) => {
    const rows = Array.isArray(resultList) ? resultList : []
    return rows
      .filter((track) => track?.trackName && track?.artistName)
      .map((track) => {
        const rawArtwork = track.artworkUrl100 || track.artworkUrl60 || null
        return {
          id: track.trackId,
          title: track.trackName,
          artist: track.artistName,
          album: track.collectionName,
          year: track.releaseDate ? new Date(track.releaseDate).getFullYear() : null,
          genre: mapGenre(track.primaryGenreName),
          previewUrl: track.previewUrl,
          artworkUrl: rawArtwork ? rawArtwork.replace('100x100bb', '600x600bb') : null,
          trackViewUrl: track.trackViewUrl,
        }
      })
      .filter((track) => track.artworkUrl)
  }

  const fetchPromise = (async () => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 1400)
      const res = await fetch(url.toString(), { signal: controller.signal })
      clearTimeout(timeout)
      if (!res.ok) return []
      const json = await res.json()
      return deduplicate(toTracks(json.results)).slice(0, 8)
    } catch {
      return []
    }
  })()

  const jsonpPromise = searchSongsViaJsonp(query, 20)
    .then((rows) => deduplicate(toTracks(rows)).slice(0, 8))
    .catch(() => [])

  const firstResult = await Promise.race([fetchPromise, jsonpPromise])
  if (firstResult.length > 0) {
    remember(cache, key, firstResult, SEARCH_KEEP)
    return firstResult
  }

  const [fromFetch, fromJsonp] = await Promise.all([fetchPromise, jsonpPromise])
  const results = fromFetch.length > 0 ? fromFetch : fromJsonp
  remember(cache, key, results, SEARCH_KEEP)
  return results
}

export async function findArtwork({ title, artist }) {
  const key = artworkKey({ title, artist })
  const known = knownArtwork(key)
  if (known) return known

  const queries = [
    [title, artist].filter(Boolean).join(' '),
    title || '',
  ].map((q) => q.trim()).filter((q) => q.length >= 2)

  for (const query of queries) {
    try {
      const [match] = await searchSongs(query)
      if (match?.artworkUrl) {
        keepArtwork(key, match.artworkUrl)
        return match.artworkUrl
      }
    } catch {
      // Try the next query form.
    }
  }

  return null
}
