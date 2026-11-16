import { remember } from './remember'

// Album art found by title and artist, kept on the device for two weeks so a
// cover is only looked up once. Deezer's search and the iTunes one share it.
//
// Each entry keeps the moment it was found. Every save used to stamp the whole
// list with the time of that save, so nothing ever ran out and the list in
// storage only grew; now an entry goes after two weeks, and the list holds at
// most ARTWORK_LOOKUP_LIMIT.

const STORAGE_KEY = 'tempify_artwork_lookup_cache_v1'
const TTL_MS = 1000 * 60 * 60 * 24 * 14
export const ARTWORK_LOOKUP_LIMIT = 300

const found = new Map()
let loaded = false

export function artworkKey({ title, artist }) {
  return `${(title || '').trim().toLowerCase()}|||${(artist || '').trim().toLowerCase()}`
}

function storage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function load(now) {
  if (loaded) return
  loaded = true
  try {
    const parsed = JSON.parse(storage()?.getItem(STORAGE_KEY) || 'null')
    if (!parsed || typeof parsed !== 'object') return
    Object.entries(parsed)
      .filter(([, entry]) => entry?.url && Number.isFinite(entry.savedAt) && now - entry.savedAt <= TTL_MS)
      // Oldest first, so the newest are the ones kept.
      .sort((a, b) => a[1].savedAt - b[1].savedAt)
      .forEach(([key, entry]) => {
        remember(found, key, { url: entry.url, savedAt: entry.savedAt }, ARTWORK_LOOKUP_LIMIT)
      })
  } catch {
    // Unreadable: start over.
  }
}

function save() {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(found)))
  } catch {
    // Full or blocked: the list still works until the app closes.
  }
}

/** The cover found for `key` in the last two weeks, or undefined. */
export function knownArtwork(key, now = Date.now()) {
  load(now)
  const entry = found.get(key)
  if (!entry) return undefined
  if (now - entry.savedAt > TTL_MS) {
    found.delete(key)
    return undefined
  }
  return entry.url
}

/** Keeps a cover found for `key`. */
export function keepArtwork(key, url, now = Date.now()) {
  load(now)
  remember(found, key, { url, savedAt: now }, ARTWORK_LOOKUP_LIMIT)
  save()
}

/** For the tests: forgets everything held in memory, so the next call reads storage again. */
export function resetArtworkLookups() {
  found.clear()
  loaded = false
}
