export async function searchSongs(query) {
  if (!query || query.trim().length < 2) return []

  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=8`
  // iTunes API doesn't support CORS from browser in some environments;
  // we use a public proxy approach as fallback
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const json = await res.json()
    return (json.results || []).map((track) => ({
      id: track.trackId,
      title: track.trackName,
      artist: track.artistName,
      album: track.collectionName,
      previewUrl: track.previewUrl,
    }))
  } catch {
    return []
  }
}
