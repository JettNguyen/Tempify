// Lazy-loaded on first call — only used in the admin panel
let index = null
let index200 = null

async function getIndex() {
  if (!index) {
    const mod = await import('../assets/hot-100-index.json')
    index = mod.default
  }
  return index
}

async function getIndex200() {
  if (!index200) {
    const mod = await import('../assets/billboard-200-index.json')
    index200 = mod.default
  }
  return index200
}

function normalize(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Look up a song in the local Billboard Hot 100 index.
 * Returns { peak, weeksAtOne } if found, or null if never charted.
 *
 * Matching priority:
 *   1. Exact normalized title + artist
 *   2. Title match where one artist string contains the other
 *   3. Title match, best-charting entry regardless of artist
 */
export async function lookupBillboardPeak(title, artist) {
  const idx        = await getIndex()
  const normTitle  = normalize(title)
  const normArtist = normalize(artist)

  const entries = idx[normTitle]
  if (!entries || entries.length === 0) return null

  // Each entry is [normalizedArtist, peak, weeksAtOne]
  let match = entries.find(([a]) => a === normArtist)
    ?? entries.find(([a]) => a.includes(normArtist) || normArtist.includes(a))
    ?? entries[0] // sorted by peak ascending — best chart result for this title

  const [, peak, weeksAtOne] = match
  return { peak, weeksAtOne }
}

/**
 * Look up an album in the Billboard 200 index.
 * Returns { peak, weeksAtOne } if found, or null if never charted.
 * Same matching priority as lookupBillboardPeak.
 */
export async function lookupBillboard200Peak(title, artist) {
  const idx        = await getIndex200()
  const normTitle  = normalize(title)
  const normArtist = normalize(artist)

  const entries = idx[normTitle]
  if (!entries || entries.length === 0) return null

  let match = entries.find(([a]) => a === normArtist)
    ?? entries.find(([a]) => a.includes(normArtist) || normArtist.includes(a))
    ?? entries[0]

  const [, peak, weeksAtOne] = match
  return { peak, weeksAtOne }
}
