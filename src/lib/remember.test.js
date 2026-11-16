// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { remember, recall } from './remember.js'
import { knownArtwork, keepArtwork, resetArtworkLookups, ARTWORK_LOOKUP_LIMIT } from './artworkLookups.js'

describe('remember', () => {
  it('drops the entry used longest ago once past the limit', () => {
    const map = new Map()
    remember(map, 'a', 1, 2)
    remember(map, 'b', 2, 2)
    remember(map, 'c', 3, 2)
    expect([...map.keys()]).toEqual(['b', 'c'])
  })

  it('counts a read as a use', () => {
    const map = new Map()
    remember(map, 'a', 1, 2)
    remember(map, 'b', 2, 2)
    expect(recall(map, 'a')).toBe(1)
    remember(map, 'c', 3, 2)
    expect([...map.keys()]).toEqual(['a', 'c'])
  })

  it('has nothing for a key never kept', () => {
    expect(recall(new Map(), 'a')).toBe(undefined)
  })
})

const DAY = 24 * 60 * 60 * 1000
const STORAGE_KEY = 'tempify_artwork_lookup_cache_v1'

describe('artwork lookups', () => {
  beforeEach(() => {
    localStorage.clear()
    resetArtworkLookups()
  })

  it('keeps a cover for two weeks from when it was found', () => {
    keepArtwork('k', 'https://img/1', 0)
    resetArtworkLookups()
    expect(knownArtwork('k', 13 * DAY)).toBe('https://img/1')
    resetArtworkLookups()
    expect(knownArtwork('k', 15 * DAY)).toBe(undefined)
  })

  it("no longer moves every cover's date on each save", () => {
    keepArtwork('old', 'https://img/old', 0)
    keepArtwork('new', 'https://img/new', 10 * DAY)
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored.old.savedAt).toBe(0)
    expect(stored.new.savedAt).toBe(10 * DAY)
  })

  it('holds at most the limit, newest kept', () => {
    for (let i = 0; i < ARTWORK_LOOKUP_LIMIT + 20; i++) keepArtwork(`k${i}`, `https://img/${i}`, i)
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(Object.keys(stored)).toHaveLength(ARTWORK_LOOKUP_LIMIT)
    expect(stored.k0).toBe(undefined)
    expect(stored[`k${ARTWORK_LOOKUP_LIMIT + 19}`]).toBeTruthy()
  })

  it('trims an old, overgrown list when it loads', () => {
    const big = {}
    for (let i = 0; i < ARTWORK_LOOKUP_LIMIT + 50; i++) big[`k${i}`] = { url: `https://img/${i}`, savedAt: DAY + i }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(big))
    expect(knownArtwork(`k${ARTWORK_LOOKUP_LIMIT + 49}`, 2 * DAY)).toBe(`https://img/${ARTWORK_LOOKUP_LIMIT + 49}`)
    expect(knownArtwork('k0', 2 * DAY)).toBe(undefined)
  })
})
