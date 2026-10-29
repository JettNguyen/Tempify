// Loose comparisons for One Bar's near misses. The answer check itself stays
// exact; these only decide whether a wrong guess was close enough to say so.

// Ways a credit joins more than one artist.
const SEPARATORS = /\s*(?:,|&|\+|\/|\band\b|\bfeat\.?|\bft\.?|\bfeaturing\b|\bwith\b|\bx\b|\bvs\.?)\s*/i

function normalize(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9$]+/g, ' ')
    .trim()
}

/** Every artist named in a credit, normalized. */
export function artistNames(credit) {
  if (!credit) return []
  return credit
    .split(SEPARATORS)
    .map(normalize)
    .filter(Boolean)
}

/**
 * Whether two credits share an artist: "Calvin Harris" and "Calvin Harris &
 * Dua Lipa" do, so a guess of the other song on that record counts as close.
 */
export function sharesArtist(a, b) {
  const left = artistNames(a)
  if (!left.length) return false
  const right = new Set(artistNames(b))
  return left.some((name) => right.has(name))
}
