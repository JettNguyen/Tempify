// Caches that last as long as the app is open. The iPhone app can stay open
// for days, so each one holds a set number of entries and lets go of the one
// used longest ago, rather than growing with every page and every search.
//
// A Map keeps the order keys went in, so that order doubles as recency: a key
// put back, or read through recall(), moves to the end, and the front is the
// one to drop.

/** Puts a value in `map`, keeping at most `limit` entries. Returns the value. */
export function remember(map, key, value, limit) {
  map.delete(key)
  map.set(key, value)
  while (map.size > limit) map.delete(map.keys().next().value)
  return value
}

/** The value for `key`, or undefined, marking it as just used. */
export function recall(map, key) {
  if (!map.has(key)) return undefined
  const value = map.get(key)
  map.delete(key)
  map.set(key, value)
  return value
}
