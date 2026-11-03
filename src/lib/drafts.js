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
    // Billboard prints "Show And Tell" where a store has "Show & Tell".
    .replace(/&/g, ' and ')
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

// ─── The week ────────────────────────────────────────────────────────────────

// Monday is the easiest day and Sunday the hardest, so someone who plays all
// week feels it climb. Levels run from 1 to 7, the same scale as the
// `difficulty_tier` the puzzle agent writes on every puzzle.
export const MIDDLE_LEVEL = 4

/** How hard a date's puzzle should be: 1 on a Monday up to 7 on a Sunday. */
export function dayLevel(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return MIDDLE_LEVEL
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).getDay() || 7
}

// What each level changes, easiest first. Fame is weeks on the chart: a song
// that stayed 20 weeks is one most people still know, and one that stayed 8
// is one mostly fans do. Each is a [least, most] range: the harder days leave
// out the most famous songs too, or a Saturday would still be mostly
// Monday's songs.
const ANY = Infinity
const RAMP = {
  // Weeks on the chart, for a top-20 song in Hit or Miss
  peakWeeks:     [[20, ANY], [16, ANY], [13, 40], [11, 32], [10, 30], [8, 22], [6, 16]],
  // Hits the act has had, behind a lower peak
  peakActHits:   [[12, ANY], [9, ANY], [7, ANY], [6, ANY], [5, ANY], [4, 40], [3, 20]],
  timelineWeeks: [[16, ANY], [14, ANY], [12, 40], [11, 34], [10, 30], [9, 24], [8, 20]],
  tempoWeeks:    [[22, ANY], [19, ANY], [17, ANY], [16, ANY], [15, 40], [13, 30], [11, 24]],
  // Years between Era's songs
  timelineGap:   [6, 5, 4, 4, 4, 3, 2],
}

const ramp = (knob, level = MIDDLE_LEVEL) => RAMP[knob][Math.min(7, Math.max(1, level)) - 1]
const within = ([least, most], n) => n >= least && n <= most

/** The gap Era's songs keep on a level, for Admin's note. */
export const timelineGap = (level) => ramp('timelineGap', level)

// ─── Hit or Miss (Peak) ──────────────────────────────────────────────────────

// The dial's zones, the same as the chart fact's letters: A the top 10, B #11
// to #40, C #41 to #100, and D never charted (drafted on its own below). A day
// takes three of the four, one song each, and which is left out changes, so
// there isn't always a song that never charted.
export const PEAK_ZONES = [[1, 10], [11, 40], [41, 100]]

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

async function draftChartedPeak(songs, zone, ctx) {
  const [lo, hi] = zone
  const hits = hitsByArtist(songs)
  const weeks = ramp('peakWeeks', ctx.level)
  const actHits = ramp('peakActHits', ctx.level)
  // A top-20 song is known by how long it charted. Lower peaks are only a
  // puzzle from an act people know: a #74 by a stranger is just a stranger.
  const pool = songs.filter(s =>
    s.peak >= lo && s.peak <= hi &&
    s.year >= 1965 && s.year < THIS_YEAR &&
    (s.peak <= 20 ? within(weeks, s.weeks) : within(actHits, hits.get(artistNames(s.artist)[0]) || 0)),
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

/**
 * Three songs, each from a different zone of the dial, in a shuffled order. A
 * higher level reaches for songs fewer people remember.
 */
export async function draftPeak({ used = new Set(), level, onProgress, count = 3 } = {}) {
  const songs = await loadChartSongs()
  const ctx = { used, level, artists: new Set() }
  const rounds = []
  // null is the never-charted zone. Past four songs (an old five-song day
  // drafted again), the extra ones come from the chart.
  const zones = shuffle([...PEAK_ZONES, null])
  while (zones.length < count) zones.push(PEAK_ZONES[Math.floor(Math.random() * PEAK_ZONES.length)])
  for (const zone of zones.slice(0, count)) {
    const round = zone ? await draftChartedPeak(songs, zone, ctx) : await draftNeverCharted(songs, ctx)
    if (round) rounds.push(round)
    onProgress?.(rounds.length)
  }
  return shuffle(rounds)
}

/** A new song for one round of a Peak draft, from the same zone of the dial. */
export async function redraftPeakRound(rounds, index, { used = new Set(), level } = {}) {
  const songs = await loadChartSongs()
  const others = rounds.filter((_, i) => i !== index)
  const ctx = {
    level,
    used: new Set([...used, ...rounds.map(r => songKey(r.title, r.artist))]),
    artists: new Set(others.map(r => artistNames(r.artist)[0])),
  }
  const old = rounds[index]
  if (!old?.peak) return draftNeverCharted(songs, ctx)
  const zone = PEAK_ZONES.find(([lo, hi]) => old.peak >= lo && old.peak <= hi) || PEAK_ZONES[0]
  return draftChartedPeak(songs, zone, ctx)
}

// ─── Era (Timeline) ──────────────────────────────────────────────────────────

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

function timelinePool(songs, level) {
  // Big hits only: placing a song you have never heard is a guess, not a game.
  const weeks = ramp('timelineWeeks', level)
  return songs.filter(s => s.peak <= 20 && within(weeks, s.weeks) && s.year >= 1960 && s.year < THIS_YEAR)
}

const spaced = (years, gap) => (song) => years.every(y => Math.abs(y - song.year) >= gap)

/**
 * Five songs from five different stretches of time. The first is the one
 * placed for you. Years far apart can be told apart by ear, so a higher level
 * lets them sit closer.
 */
export async function draftTimeline({ used = new Set(), level, onProgress } = {}) {
  const pool = timelinePool(await loadChartSongs(), level)
  const gap = timelineGap(level)
  const ctx = { used, artists: new Set() }
  const rounds = []
  for (let i = 0; i < 5; i++) {
    const found = await pickWithClip(pool, { ...ctx, fits: spaced(rounds.map(r => r.year), gap) })
    if (found) rounds.push(timelineRound(found.song, found.clip))
    onProgress?.(rounds.length)
  }
  return shuffle(rounds)
}

export async function redraftTimelineRound(rounds, index, { used = new Set(), level } = {}) {
  const pool = timelinePool(await loadChartSongs(), level)
  const gap = timelineGap(level)
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

function tempoPool(songs, level) {
  // Songs everyone can hear in their head: the beat has to come from memory.
  const weeks = ramp('tempoWeeks', level)
  return songs.filter(s => s.peak <= 10 && within(weeks, s.weeks) && s.year >= 1960 && s.year < THIS_YEAR)
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

/** Three big hits that Deezer has a tempo for, and a clip each. */
export async function draftTempo({ used = new Set(), level, onProgress, count = 3 } = {}) {
  const pool = tempoPool(await loadChartSongs(), level)
  const ctx = { used, artists: new Set() }
  const rounds = []
  for (let i = 0; i < count; i++) {
    const round = await pickTempoSong(pool, ctx)
    if (round) rounds.push(round)
    onProgress?.(rounds.length)
  }
  return rounds
}

export async function redraftTempoRound(rounds, index, { used = new Set(), level } = {}) {
  const pool = tempoPool(await loadChartSongs(), level)
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
