// In dev, requests go through the Vite proxy (/itunes → itunes.apple.com).
// In production, use a Supabase Edge Function proxy when VITE_ITUNES_PROXY_URL is set.
const PROXY_URL = import.meta.env.VITE_ITUNES_PROXY_URL
  ? import.meta.env.VITE_ITUNES_PROXY_URL.replace(/\/$/, '')
  : null
const BASE = PROXY_URL
  ? PROXY_URL
  : import.meta.env.DEV
    ? '/itunes'
    : 'https://itunes.apple.com'
const PROXY_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Session-level cache: query string → results array
const cache = new Map()

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
const VARIANT_RE = /\s*[\(\[]\s*(feat\.|ft\.|featuring|remix|remixed|remaster|remastered|live|edit|version|radio\s*edit|acoustic|instrumental|deluxe|extended|mix|reprise|cover|tribute|explicit|clean|mono|stereo|single\s*version|original\s*mix|bonus)\b.*[\)\]]\s*$/gi

function stripVariant(title) {
  return title.replace(VARIANT_RE, '').trim()
}

function deduplicate(tracks) {
  const seen = new Map()
  for (const t of tracks) {
    const key = `${stripVariant(t.title).toLowerCase()}|||${t.artist.toLowerCase()}`
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, t)
    } else {
      // Prefer: has preview > shorter title (fewer variant words) > original order
      const betterPreview = !existing.previewUrl && t.previewUrl
      const shorter = t.title.length < existing.title.length
      if (betterPreview || (!existing.previewUrl && shorter)) {
        seen.set(key, t)
      }
    }
  }
  return Array.from(seen.values())
}

export async function searchSongs(query) {
  if (!query || query.trim().length < 2) return []

  const key = query.trim().toLowerCase()
  if (cache.has(key)) return cache.get(key)

  // Fetch more than we need so deduplication still leaves enough results
  const url = new URL(`${BASE}/search`)
  url.searchParams.set('term', query)
  url.searchParams.set('entity', 'song')
  url.searchParams.set('limit', '20')
  const headers = {}
  if (PROXY_URL && PROXY_KEY) {
    headers.Authorization = `Bearer ${PROXY_KEY}`
    headers.apikey = PROXY_KEY
  }

  try {
    const res = await fetch(url.toString(), { headers })
    if (!res.ok) return []
    const json = await res.json()
    const tracks = (json.results || []).map((track) => ({
      id: track.trackId,
      title: track.trackName,
      artist: track.artistName,
      album: track.collectionName,
      year: track.releaseDate ? new Date(track.releaseDate).getFullYear() : null,
      genre: mapGenre(track.primaryGenreName),
      previewUrl: track.previewUrl,
      artworkUrl: track.artworkUrl100?.replace('100x100bb', '600x600bb') ?? null,
      trackViewUrl: track.trackViewUrl,
    }))
    const results = deduplicate(tracks).slice(0, 8)
    cache.set(key, results)
    return results
  } catch {
    return []
  }
}

export async function findArtwork({ title, artist }) {
  const query = [title, artist].filter(Boolean).join(' ')
  const [match] = await searchSongs(query)
  return match?.artworkUrl ?? null
}
