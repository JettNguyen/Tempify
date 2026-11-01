// Puzzle drafts for Admin. A draft picks songs out of the Hot 100's history
// and finds each one an Apple clip; a person listens, swaps any bad pick and
// saves. Nothing here writes anywhere.
//
// The chart list is src/assets/hot-100-songs.json, built by
// scripts/build-hot-100-songs.js. Its years are the week a song first
// charted, which is what "when was it a hit" means, and which avoids the
// remaster and compilation dates a store listing carries.

import { searchSongs, stripVariant } from './itunes'
import { findTrackBpm } from './deezer'
import { artistNames, sharesArtist } from './matching'

let chartSongs = null

/** Every song that ever charted, loaded the first time a draft needs it. */
export function loadChartSongs() {
  chartSongs ||= import('../assets/hot-100-songs.json').then(({ default: rows }) =>
    rows.map(([title, artist, peak, weeks, weeksAtOne, firstWeek]) => ({
      title, artist, peak, weeks, weeksAtOne, firstWeek, year: Number(firstWeek.slice(0, 4)),
    })),
  )
  return chartSongs
}

/**
 * A title the way a store lists it, minus what stores add: "(From "The
 * Goonies" Soundtrack)", "- Remastered 2011", "(feat. ...)".
 */
function storeTitle(title) {
  return stripVariant(title || '')
    .replace(/\s*[([]\s*from\b[^)\]]*[)\]]/gi, '')
    .replace(/\s*[([][^)\]]*\b(?:mix|edit|version|remaster(?:ed)?|mono|stereo)\b[^)\]]*[)\]]/gi, '')
    .replace(/\s+-\s+.*$/, '')
    .trim()
}

/**
 * A title for comparing, with every bracketed part gone: Billboard's "(I Can't
 * Get No) Satisfaction" and a store's "Satisfaction (Mono)" are one song.
 */
function plainTitle(title) {
  return storeTitle(title)
    .replace(/[([][^)\]]*[)\]]/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * The same song under any credit: "Old Town Road" by "Lil Nas X Featuring
 * Billy Ray Cyrus" and by "Lil Nas X" are one song for "used before".
 */
export function songKey(title, artist) {
  return `${plainTitle(title)}|${artistNames(artist)[0] || ''}`
}

/** The headline act of a credit, for searching: "Drake Featuring Rihanna" is Drake. */
function leadArtist(credit) {
  return credit.split(/\s+(?:featuring|feat\.?|ft\.?|with|x)\s+/i)[0].trim()
}

/** Billboard's credit, written the way a store writes it. */
function displayArtist(credit) {
  return credit.replace(/\s+Featuring\s+/g, ' feat. ')
}

// A clip that isn't the studio recording would be the wrong song to judge.
const NOT_THE_RECORD = /\b(live|remix|karaoke|instrumental|acoustic|cover|tribute|re-?recorded|sped up|slowed|demo|originally performed)\b/i

/** The store's studio recording of a song, or null. */
export async function findClip(title, artist) {
  const hits = await searchSongs(`${stripVariant(title)} ${leadArtist(artist)}`)
  const want = plainTitle(title)
  const hit = hits.find(h =>
    h.previewUrl &&
    plainTitle(h.title) === want &&
    sharesArtist(h.artist, artist) &&
    !NOT_THE_RECORD.test(h.title) &&
    !NOT_THE_RECORD.test(h.album || ''),
  )
  if (!hit) return null
  return {
    audio_url: hit.previewUrl,
    artwork_url: hit.artworkUrl,
    itunes_url: hit.trackViewUrl || null,
    genre: hit.genre || null,
    storeYear: hit.year,
  }
}

function shuffle(list) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Tries songs from a pool in random order until one has a clip. Skips songs
 * used before and artists already in today's set. Tries are capped because
 * the store's search allows about 20 calls a minute.
 */
async function pickWithClip(pool, { used, artists, fits = () => true, tries = 6 }) {
  let tried = 0
  for (const song of shuffle(pool)) {
    if (tried >= tries) break
    const lead = artistNames(song.artist)[0]
    if (used.has(songKey(song.title, song.artist)) || artists.has(lead) || !fits(song)) continue
    tried++
    const clip = await findClip(song.title, song.artist)
    if (!clip) continue
    artists.add(lead)
    return { song, clip }
  }
  return null
}

const THIS_YEAR = new Date().getFullYear()

// Hit counts per headline act, for telling a famous artist from a one-off.
// Counted once: it's the same 32,000 songs every time.
let hitCounts = null
function hitsByArtist(songs) {
  if (hitCounts) return hitCounts
  hitCounts = new Map()
  for (const s of songs) {
    const lead = artistNames(s.artist)[0]
    hitCounts.set(lead, (hitCounts.get(lead) || 0) + 1)
  }
  return hitCounts
}

// ─── Hit or Miss (Peak) ──────────────────────────────────────────────────────

// One song from each stretch of the chart, so a day runs from a #1 to a #90
// and the dial gets used end to end.
export const PEAK_BANDS = [[1, 5], [6, 20], [21, 50], [51, 100]]

function peakRound(song, clip) {
  return {
    title: song.title,
    artist: displayArtist(song.artist),
    year: song.year,
    peak: song.peak,
    weeks_on_chart: song.weeks,
    weeks_at_one: song.weeksAtOne,
    audio_url: clip.audio_url,
    artwork_url: clip.artwork_url,
    itunes_url: clip.itunes_url,
    genre: clip.genre,
  }
}

async function draftChartedPeak(songs, band, ctx) {
  const [lo, hi] = band
  const hits = hitsByArtist(songs)
  // Low peaks are only a puzzle from an act people know: a #74 by a
  // stranger is just a stranger.
  const pool = songs.filter(s =>
    s.peak >= lo && s.peak <= hi &&
    s.year >= 1965 && s.year < THIS_YEAR &&
    (hi <= 20 ? s.weeks >= 10 : (hits.get(artistNames(s.artist)[0]) || 0) >= 5),
  )
  const found = await pickWithClip(pool, ctx)
  return found && peakRound(found.song, found.clip)
}

/**
 * A song by a big act that never made the Hot 100: the store lists their
 * songs, and the chart history says which never charted.
 */
async function draftNeverCharted(songs, { used, artists }) {
  const hits = hitsByArtist(songs)
  const chartedTitles = new Set(songs.map(s => plainTitle(s.title)))
  const acts = shuffle([...new Map(
    songs
      .filter(s => s.year >= 1970 && (hits.get(artistNames(s.artist)[0]) || 0) >= 8)
      .map(s => [artistNames(s.artist)[0], leadArtist(s.artist)]),
  ).entries()])

  for (const [lead, name] of acts.slice(0, 4)) {
    if (artists.has(lead)) continue
    const tracks = await searchSongs(name)
    // This act's own hits, to catch one listed under a longer or shorter
    // title than Billboard printed.
    const theirs = songs.filter(s => sharesArtist(s.artist, name)).map(s => plainTitle(s.title))
    const track = tracks.find(t => {
      const title = plainTitle(t.title)
      return t.previewUrl &&
      sharesArtist(t.artist, name) &&
      t.year && t.year < THIS_YEAR &&
      // A title anyone charted with is left out, so a never-charted answer
      // can't be someone's hit under a slightly different credit.
      !chartedTitles.has(title) &&
      !theirs.some(hit => hit.includes(title) || title.includes(hit)) &&
      !used.has(songKey(t.title, t.artist)) &&
      !NOT_THE_RECORD.test(t.title) &&
      !NOT_THE_RECORD.test(t.album || '')
    })
    if (!track) continue
    artists.add(lead)
    return {
      title: storeTitle(track.title),
      artist: track.artist,
      year: track.year,
      peak: 0,
      weeks_on_chart: 0,
      weeks_at_one: 0,
      audio_url: track.previewUrl,
      artwork_url: track.artworkUrl,
      itunes_url: track.trackViewUrl || null,
      genre: track.genre || null,
    }
  }
  return null
}

/** Five songs: one from each stretch of the chart and one that never charted, shuffled. */
export async function draftPeak({ used = new Set(), onProgress } = {}) {
  const songs = await loadChartSongs()
  const ctx = { used, artists: new Set() }
  const rounds = []
  for (const band of PEAK_BANDS) {
    const round = await draftChartedPeak(songs, band, ctx)
    if (round) rounds.push(round)
    onProgress?.(rounds.length)
  }
  const never = await draftNeverCharted(songs, ctx)
  if (never) rounds.push(never)
  onProgress?.(rounds.length)
  return shuffle(rounds)
}

/** A new song for one round of a Peak draft, from the same stretch of the chart. */
export async function redraftPeakRound(rounds, index, { used = new Set() } = {}) {
  const songs = await loadChartSongs()
  const others = rounds.filter((_, i) => i !== index)
  const ctx = {
    used: new Set([...used, ...rounds.map(r => songKey(r.title, r.artist))]),
    artists: new Set(others.map(r => artistNames(r.artist)[0])),
  }
  const old = rounds[index]
  if (!old?.peak) return draftNeverCharted(songs, ctx)
  const band = PEAK_BANDS.find(([lo, hi]) => old.peak >= lo && old.peak <= hi) || PEAK_BANDS[0]
  return draftChartedPeak(songs, band, ctx)
}

// ─── Era (Timeline) ──────────────────────────────────────────────────────────

// Years this far apart can be told apart by ear. Closer is a harder day.
export const TIMELINE_GAP = 3

function timelineRound(song, clip) {
  return {
    title: song.title,
    artist: displayArtist(song.artist),
    year: song.year,
    audio_url: clip.audio_url,
    artwork_url: clip.artwork_url,
    itunes_url: clip.itunes_url,
    genre: clip.genre,
  }
}

function timelinePool(songs) {
  // Big hits only: placing a song you have never heard is a guess, not a game.
  return songs.filter(s => s.peak <= 20 && s.weeks >= 10 && s.year >= 1960 && s.year < THIS_YEAR)
}

const spaced = (years, gap) => (song) => years.every(y => Math.abs(y - song.year) >= gap)

/** Five songs from five different stretches of time. The first is the one placed for you. */
export async function draftTimeline({ used = new Set(), gap = TIMELINE_GAP, onProgress } = {}) {
  const pool = timelinePool(await loadChartSongs())
  const ctx = { used, artists: new Set() }
  const rounds = []
  for (let i = 0; i < 5; i++) {
    const found = await pickWithClip(pool, { ...ctx, fits: spaced(rounds.map(r => r.year), gap) })
    if (found) rounds.push(timelineRound(found.song, found.clip))
    onProgress?.(rounds.length)
  }
  return shuffle(rounds)
}

export async function redraftTimelineRound(rounds, index, { used = new Set(), gap = TIMELINE_GAP } = {}) {
  const pool = timelinePool(await loadChartSongs())
  const others = rounds.filter((_, i) => i !== index)
  const found = await pickWithClip(pool, {
    used: new Set([...used, ...rounds.map(r => songKey(r.title, r.artist))]),
    artists: new Set(others.map(r => artistNames(r.artist)[0])),
    fits: spaced(others.map(r => r.year), gap),
  })
  return found && timelineRound(found.song, found.clip)
}

// ─── Tap the Tempo ──────────────────────────────────────────────────────────

// Tempos a person can tap. Outside this a stored tempo is more likely a
// half or double time misread than the song.
const TAPPABLE = [60, 200]

function tempoPool(songs) {
  // Songs everyone can hear in their head: the beat has to come from memory.
  return songs.filter(s => s.peak <= 10 && s.weeks >= 15 && s.year >= 1960 && s.year < THIS_YEAR)
}

async function pickTempoSong(pool, { used, artists, tries = 8 }) {
  let tried = 0
  for (const song of shuffle(pool)) {
    if (tried >= tries) break
    const lead = artistNames(song.artist)[0]
    if (used.has(songKey(song.title, song.artist)) || artists.has(lead)) continue
    tried++
    const bpm = await findTrackBpm(stripVariant(song.title), leadArtist(song.artist))
    if (!bpm || bpm < TAPPABLE[0] || bpm > TAPPABLE[1]) continue
    const clip = await findClip(song.title, song.artist)
    if (!clip) continue
    artists.add(lead)
    return {
      title: song.title,
      artist: displayArtist(song.artist),
      year: song.year,
      bpm,
      audio_url: clip.audio_url,
      artwork_url: clip.artwork_url,
      itunes_url: clip.itunes_url,
      genre: clip.genre,
    }
  }
  return null
}

/** Five big hits that Deezer has a tempo for, and a clip each. */
export async function draftTempo({ used = new Set(), onProgress } = {}) {
  const pool = tempoPool(await loadChartSongs())
  const ctx = { used, artists: new Set() }
  const rounds = []
  for (let i = 0; i < 5; i++) {
    const round = await pickTempoSong(pool, ctx)
    if (round) rounds.push(round)
    onProgress?.(rounds.length)
  }
  return rounds
}

export async function redraftTempoRound(rounds, index, { used = new Set() } = {}) {
  const pool = tempoPool(await loadChartSongs())
  const others = rounds.filter((_, i) => i !== index)
  return pickTempoSong(pool, {
    used: new Set([...used, ...rounds.map(r => songKey(r.title, r.artist))]),
    artists: new Set(others.map(r => artistNames(r.artist)[0])),
  })
}

/** The genre most of a day's songs share, for the puzzle's genre tag. */
export function commonGenre(rounds) {
  const counts = new Map()
  rounds.forEach(r => { if (r.genre) counts.set(r.genre, (counts.get(r.genre) || 0) + 1) })
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null
}
