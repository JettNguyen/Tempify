const BASE = 'https://musicbrainz.org/ws/2'
const HEADERS = { 'User-Agent': 'Tempify/1.0 (admin-tool)' }

/**
 * Search MusicBrainz for recordings matching a title + optional artist.
 * Returns up to `limit` results with { title, artist, year, mbid }.
 */
export async function searchRecordings(title, artist = '', limit = 6) {
  let query = `recording:"${title}"`
  if (artist) query += ` AND artistname:"${artist}"`

  const url = `${BASE}/recording?query=${encodeURIComponent(query)}&limit=${limit}&fmt=json`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`MusicBrainz error: ${res.status}`)
  const data = await res.json()

  return (data.recordings || []).map((r) => {
    // Prefer the earliest release date across all linked releases
    const dates = (r.releases || [])
      .map((rel) => rel.date)
      .filter(Boolean)
      .sort()
    const date = dates[0] || null
    const year = date ? parseInt(date.slice(0, 4), 10) : null

    return {
      mbid:   r.id,
      title:  r.title,
      artist: r['artist-credit']?.[0]?.name || '',
      year,
    }
  })
}
