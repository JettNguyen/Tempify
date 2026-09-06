const PROXY_URL = import.meta.env.VITE_DEEZER_PROXY_URL
  ? import.meta.env.VITE_DEEZER_PROXY_URL.replace(/\/$/, '')
  : null
const BASE = PROXY_URL
  ? PROXY_URL
  : import.meta.env.DEV
    ? '/deezer'
    : 'https://api.deezer.com'

const cache = new Map()
const artworkLookupCache = new Map()
const ARTWORK_CACHE_STORAGE_KEY = 'tempify_artwork_lookup_cache_v1'
const ARTWORK_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14

function artworkKey({ title, artist }) {
  return `${(title || '').trim().toLowerCase()}|||${(artist || '').trim().toLowerCase()}`
}

function hydrateArtworkCache() {
  if (typeof window === 'undefined') return
  if (artworkLookupCache.size > 0) return

  try {
    const raw = window.localStorage.getItem(ARTWORK_CACHE_STORAGE_KEY)
    if (!raw) return

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return

    const now = Date.now()
    Object.entries(parsed).forEach(([key, entry]) => {
      if (!entry?.url || !entry?.savedAt) return
      if (now - entry.savedAt > ARTWORK_CACHE_TTL_MS) return
      artworkLookupCache.set(key, entry.url)
    })
  } catch {
    // Ignore localStorage parse errors.
  }
}

function persistArtworkCache() {
  if (typeof window === 'undefined') return

  try {
    const now = Date.now()
    const payload = {}
    artworkLookupCache.forEach((url, key) => {
      payload[key] = { url, savedAt: now }
    })
    window.localStorage.setItem(ARTWORK_CACHE_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore quota/storage errors.
  }
}

const GENRE_MAP = {
  'pop':               'Pop',
  'dance':             'Pop',
  'rap/hip hop':       'Hip-Hop',
  'hip hop':           'Hip-Hop',
  'hip-hop':           'Hip-Hop',
  'rap':               'Hip-Hop',
  'r&b':               'R&B',
  'soul':              'R&B',
  'funk/soul':         'R&B',
  'rock':              'Rock',
  'hard rock':         'Rock',
  'classic rock':      'Rock',
  'alternative':       'Indie',
  'indie pop':         'Indie',
  'indie':             'Indie',
  'singer/songwriter': 'Folk',
  'folk':              'Folk',
  'acoustic':          'Folk',
  'electronic':        'Electronic',
  'edm':               'Electronic',
  'dance/edm':         'Electronic',
  'house':             'Electronic',
  'techno':            'Electronic',
  'country':           'Country',
  'jazz':              'Jazz',
  'blues':             'Jazz',
  'metal':             'Metal',
  'heavy metal':       'Metal',
  'latin':             'Latin',
  'reggae':            'Reggae',
  'dancehall':         'Reggae',
  'k-pop':             'K-Pop',
  'korean pop':        'K-Pop',
}

function mapGenre(raw) {
  if (!raw) return null
  return GENRE_MAP[raw.toLowerCase()] ?? null
}

const VARIANT_RE = /\s*[\(\[]\s*(feat\.|ft\.|featuring|remix|remixed|remaster|remastered|live|edit|version|radio\s*edit|acoustic|instrumental|deluxe|extended|mix|reprise|cover|tribute|explicit|clean|mono|stereo|single\s*version|original\s*mix|bonus).*[\)\]]\s*$/gi

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
      const betterPreview = !existing.previewUrl && t.previewUrl
      const shorter = t.title.length < existing.title.length
      if (betterPreview || (!existing.previewUrl && shorter)) {
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

function toTracks(dataArray) {
  const rows = Array.isArray(dataArray) ? dataArray : []
  return rows
    .filter((track) => track?.title && track?.artist?.name)
    .map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist.name,
      album: track.album?.title ?? null,
      albumId: track.album?.id ?? null,
      year: null,
      genre: null,
      previewUrl: track.preview || null,
      artworkUrl: track.album?.cover_xl || track.album?.cover_big || null,
      trackViewUrl: track.link || null,
    }))
    .filter((track) => track.artworkUrl)
}

// Returns { tracks, failed }. `failed` is true only when the request itself
// could not complete (offline, timeout, proxy error) so callers can tell
// "nothing matched" apart from "search is broken right now". Failed lookups are
// never cached, otherwise one flaky request would poison that query for the
// rest of the session.
export async function searchSongsWithStatus(query) {
  if (!query || query.trim().length < 2) return { tracks: [], failed: false }

  const key = query.trim().toLowerCase()
  if (cache.has(key)) return { tracks: cache.get(key), failed: false }

  try {
    const baseStr = BASE.startsWith('/') ? `${window.location.origin}${BASE}` : BASE
    const url = new URL(`${baseStr}/search`)
    url.searchParams.set('q', query)
    url.searchParams.set('limit', '25')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(url.toString(), { signal: controller.signal })
    clearTimeout(timeout)

    if (!res.ok) return { tracks: [], failed: true }

    const json = await res.json()
    const results = deduplicate(toTracks(json.data)).slice(0, 8)
    cache.set(key, results)
    return { tracks: results, failed: false }
  } catch {
    return { tracks: [], failed: true }
  }
}

export async function searchSongs(query) {
  const { tracks } = await searchSongsWithStatus(query)
  return tracks
}

export async function fetchTrackDetails(albumId) {
  if (!albumId) return {}
  try {
    const baseStr = BASE.startsWith('/') ? `${window.location.origin}${BASE}` : BASE
    const url = new URL(`${baseStr}/album/${albumId}`)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(url.toString(), { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return {}
    const json = await res.json()
    const year = json.release_date ? new Date(json.release_date).getFullYear() : null
    const rawGenre = json.genres?.data?.[0]?.name ?? null
    const genre = mapGenre(rawGenre)
    return { year, genre }
  } catch {
    return {}
  }
}

export async function findArtwork({ title, artist }) {
  hydrateArtworkCache()

  const key = artworkKey({ title, artist })
  if (artworkLookupCache.has(key)) {
    return artworkLookupCache.get(key)
  }

  const queries = [
    [title, artist].filter(Boolean).join(' '),
    title || '',
  ].map((q) => q.trim()).filter((q) => q.length >= 2)

  for (const query of queries) {
    try {
      const [match] = await searchSongs(query)
      if (match?.artworkUrl) {
        artworkLookupCache.set(key, match.artworkUrl)
        persistArtworkCache()
        return match.artworkUrl
      }
    } catch {
      // Try the next query form.
    }
  }

  return null
}
