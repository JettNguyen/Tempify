// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchSongs, fetchTrackDetails, getCachedSongSearch, stripVariant } from './deezer.js'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeDeezerTrack(overrides = {}) {
  return {
    id: 1,
    title: 'Blinding Lights',
    preview: 'https://cdns-preview.dzcdn.net/stream/preview.mp3',
    link: 'https://www.deezer.com/track/1',
    artist: { name: 'The Weeknd' },
    album: {
      id: 99,
      title: 'After Hours',
      cover_xl: 'https://cdn-images.dzcdn.net/images/cover/xl.jpg',
      cover_big: 'https://cdn-images.dzcdn.net/images/cover/big.jpg',
    },
    ...overrides,
  }
}

function makeDeezerSearchResponse(tracks) {
  return { data: tracks }
}

function makeDeezerAlbumResponse(overrides = {}) {
  return {
    release_date: '2020-03-20',
    genres: { data: [{ name: 'Pop' }] },
    ...overrides,
  }
}

function mockFetch(responseBody, { ok = true, status = 200 } = {}) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(responseBody),
    text: () => Promise.resolve(JSON.stringify(responseBody)),
  })
}

// ─── stripVariant ───────────────────────────────────────────────────────────

describe('stripVariant', () => {
  it('strips (feat. ...) suffixes', () => {
    expect(stripVariant('Savage (feat. Beyoncé)')).toBe('Savage')
  })

  it('strips [Remastered] suffixes', () => {
    expect(stripVariant('Hotel California [Remastered]')).toBe('Hotel California')
  })

  it('strips (Remix) suffixes', () => {
    expect(stripVariant('Levitating (Remix)')).toBe('Levitating')
  })

  it('leaves plain titles untouched', () => {
    expect(stripVariant('Blinding Lights')).toBe('Blinding Lights')
  })
})

// ─── searchSongs ────────────────────────────────────────────────────────────

describe('searchSongs', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty array for short queries', async () => {
    const fetchSpy = mockFetch(makeDeezerSearchResponse([]))
    vi.stubGlobal('fetch', fetchSpy)

    expect(await searchSongs('')).toEqual([])
    expect(await searchSongs('a')).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('maps title correctly', async () => {
    vi.stubGlobal('fetch', mockFetch(makeDeezerSearchResponse([makeDeezerTrack()])))
    const results = await searchSongs('blinding lights unique1')
    expect(results[0].title).toBe('Blinding Lights')
  })

  it('maps artist correctly', async () => {
    vi.stubGlobal('fetch', mockFetch(makeDeezerSearchResponse([makeDeezerTrack()])))
    const results = await searchSongs('weeknd unique2')
    expect(results[0].artist).toBe('The Weeknd')
  })

  it('maps album correctly', async () => {
    vi.stubGlobal('fetch', mockFetch(makeDeezerSearchResponse([makeDeezerTrack()])))
    const results = await searchSongs('after hours unique3')
    expect(results[0].album).toBe('After Hours')
  })

  it('maps artworkUrl from cover_xl', async () => {
    vi.stubGlobal('fetch', mockFetch(makeDeezerSearchResponse([makeDeezerTrack()])))
    const results = await searchSongs('blinding unique4')
    expect(results[0].artworkUrl).toBe('https://cdn-images.dzcdn.net/images/cover/xl.jpg')
  })

  it('falls back to cover_big when cover_xl is missing', async () => {
    const track = makeDeezerTrack()
    delete track.album.cover_xl
    vi.stubGlobal('fetch', mockFetch(makeDeezerSearchResponse([track])))
    const results = await searchSongs('after hours unique5')
    expect(results[0].artworkUrl).toBe('https://cdn-images.dzcdn.net/images/cover/big.jpg')
  })

  it('maps previewUrl correctly', async () => {
    vi.stubGlobal('fetch', mockFetch(makeDeezerSearchResponse([makeDeezerTrack()])))
    const results = await searchSongs('blinding unique6')
    expect(results[0].previewUrl).toBe('https://cdns-preview.dzcdn.net/stream/preview.mp3')
  })

  it('sets previewUrl to null when preview is absent', async () => {
    const track = makeDeezerTrack({ preview: '' })
    vi.stubGlobal('fetch', mockFetch(makeDeezerSearchResponse([track])))
    const results = await searchSongs('blinding unique7')
    expect(results[0].previewUrl).toBeNull()
  })

  it('filters out tracks without artworkUrl', async () => {
    const noArt = makeDeezerTrack()
    noArt.album.cover_xl = undefined
    noArt.album.cover_big = undefined
    vi.stubGlobal('fetch', mockFetch(makeDeezerSearchResponse([noArt])))
    const results = await searchSongs('blinding unique8')
    expect(results).toHaveLength(0)
  })

  it('filters out tracks without title', async () => {
    const noTitle = makeDeezerTrack({ title: '' })
    vi.stubGlobal('fetch', mockFetch(makeDeezerSearchResponse([noTitle])))
    const results = await searchSongs('blinding unique9')
    expect(results).toHaveLength(0)
  })

  it('filters out tracks without artist name', async () => {
    const noArtist = makeDeezerTrack({ artist: { name: '' } })
    vi.stubGlobal('fetch', mockFetch(makeDeezerSearchResponse([noArtist])))
    const results = await searchSongs('weeknd unique10')
    expect(results).toHaveLength(0)
  })

  it('deduplicates tracks with the same title+artist', async () => {
    const t1 = makeDeezerTrack({ id: 1, title: 'Blinding Lights' })
    const t2 = makeDeezerTrack({ id: 2, title: 'Blinding Lights (Remix)', preview: '' })
    vi.stubGlobal('fetch', mockFetch(makeDeezerSearchResponse([t1, t2])))
    const results = await searchSongs('blinding unique11')
    expect(results).toHaveLength(1)
    // Keeps the one with a previewUrl
    expect(results[0].previewUrl).not.toBeNull()
  })

  it('returns empty array when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    const results = await searchSongs('blinding unique12')
    expect(results).toEqual([])
  })

  it('returns empty array on non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetch({}, { ok: false, status: 500 }))
    const results = await searchSongs('blinding unique13')
    expect(results).toEqual([])
  })

  it('returns empty array when data field is missing from response', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'not found' }))
    const results = await searchSongs('blinding unique14')
    expect(results).toEqual([])
  })

  it('caps results at 8 tracks', async () => {
    const tracks = Array.from({ length: 15 }, (_, i) =>
      makeDeezerTrack({ id: i, title: `Song ${i}`, artist: { name: `Artist ${i}` } })
    )
    vi.stubGlobal('fetch', mockFetch(makeDeezerSearchResponse(tracks)))
    const results = await searchSongs('song unique15')
    expect(results.length).toBeLessThanOrEqual(8)
  })
})

// ─── fetchTrackDetails ───────────────────────────────────────────────────────

describe('fetchTrackDetails', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('extracts year from release_date', async () => {
    vi.stubGlobal('fetch', mockFetch(makeDeezerAlbumResponse({ release_date: '2020-03-20' })))
    const { year } = await fetchTrackDetails(99)
    expect(year).toBe(2020)
  })

  it('returns null year when release_date is absent', async () => {
    vi.stubGlobal('fetch', mockFetch(makeDeezerAlbumResponse({ release_date: null })))
    const { year } = await fetchTrackDetails(99)
    expect(year).toBeNull()
  })

  it('maps known genre: Pop', async () => {
    vi.stubGlobal('fetch', mockFetch(makeDeezerAlbumResponse({ genres: { data: [{ name: 'Pop' }] } })))
    const { genre } = await fetchTrackDetails(99)
    expect(genre).toBe('Pop')
  })

  it('maps known genre: Rap/Hip Hop → Hip-Hop', async () => {
    vi.stubGlobal('fetch', mockFetch(makeDeezerAlbumResponse({ genres: { data: [{ name: 'Rap/Hip Hop' }] } })))
    const { genre } = await fetchTrackDetails(99)
    expect(genre).toBe('Hip-Hop')
  })

  it('maps known genre: R&B', async () => {
    vi.stubGlobal('fetch', mockFetch(makeDeezerAlbumResponse({ genres: { data: [{ name: 'R&B' }] } })))
    const { genre } = await fetchTrackDetails(99)
    expect(genre).toBe('R&B')
  })

  it('maps known genre: Dance/EDM → Electronic', async () => {
    vi.stubGlobal('fetch', mockFetch(makeDeezerAlbumResponse({ genres: { data: [{ name: 'Dance/EDM' }] } })))
    const { genre } = await fetchTrackDetails(99)
    expect(genre).toBe('Electronic')
  })

  it('maps known genre: Alternative → Indie', async () => {
    vi.stubGlobal('fetch', mockFetch(makeDeezerAlbumResponse({ genres: { data: [{ name: 'Alternative' }] } })))
    const { genre } = await fetchTrackDetails(99)
    expect(genre).toBe('Indie')
  })

  it('maps known genre: Singer/Songwriter → Folk', async () => {
    vi.stubGlobal('fetch', mockFetch(makeDeezerAlbumResponse({ genres: { data: [{ name: 'Singer/Songwriter' }] } })))
    const { genre } = await fetchTrackDetails(99)
    expect(genre).toBe('Folk')
  })

  it('maps known genre: K-Pop', async () => {
    vi.stubGlobal('fetch', mockFetch(makeDeezerAlbumResponse({ genres: { data: [{ name: 'K-Pop' }] } })))
    const { genre } = await fetchTrackDetails(99)
    expect(genre).toBe('K-Pop')
  })

  it('returns null genre for unknown genre strings', async () => {
    vi.stubGlobal('fetch', mockFetch(makeDeezerAlbumResponse({ genres: { data: [{ name: 'New Age' }] } })))
    const { genre } = await fetchTrackDetails(99)
    expect(genre).toBeNull()
  })

  it('returns null genre when genres array is empty', async () => {
    vi.stubGlobal('fetch', mockFetch(makeDeezerAlbumResponse({ genres: { data: [] } })))
    const { genre } = await fetchTrackDetails(99)
    expect(genre).toBeNull()
  })

  it('returns null genre when genres field is absent', async () => {
    vi.stubGlobal('fetch', mockFetch(makeDeezerAlbumResponse({ genres: undefined })))
    const { genre } = await fetchTrackDetails(99)
    expect(genre).toBeNull()
  })

  it('returns empty object when albumId is falsy', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    expect(await fetchTrackDetails(null)).toEqual({})
    expect(await fetchTrackDetails(0)).toEqual({})
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns empty object when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')))
    expect(await fetchTrackDetails(99)).toEqual({})
  })

  it('returns empty object on non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetch({}, { ok: false, status: 404 }))
    expect(await fetchTrackDetails(99)).toEqual({})
  })
})

// ─── getCachedSongSearch ─────────────────────────────────────────────────────

describe('getCachedSongSearch', () => {
  it('returns empty array for empty query', () => {
    expect(getCachedSongSearch('')).toEqual([])
    expect(getCachedSongSearch('  ')).toEqual([])
  })

  it('returns empty array for uncached query', () => {
    expect(getCachedSongSearch('zzz_not_cached_xyz')).toEqual([])
  })
})
