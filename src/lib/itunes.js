// In dev, requests go through the Vite proxy (/itunes → itunes.apple.com)
// to avoid CORS. In production the iTunes API allows cross-origin directly.
const BASE = import.meta.env.DEV
  ? '/itunes'
  : 'https://itunes.apple.com'

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

export async function searchSongs(query) {
  if (!query || query.trim().length < 2) return []

  const url = `${BASE}/search?term=${encodeURIComponent(query)}&entity=song&limit=8`
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const json = await res.json()
    return (json.results || []).map((track) => ({
      id: track.trackId,
      title: track.trackName,
      artist: track.artistName,
      album: track.collectionName,
      year: track.releaseDate ? new Date(track.releaseDate).getFullYear() : null,
      genre: mapGenre(track.primaryGenreName),
      previewUrl: track.previewUrl,
    }))
  } catch {
    return []
  }
}
