// The songs in a game a player makes. They're picked from the same search
// One Bar's guesses use (Deezer), so a One Bar answer is exactly what a
// friend can pick. Each one then gets an Apple clip, the kind the daily
// games play, since Deezer's expire. The answers come from the Hot 100 list
// the app ships: the year a song first charted, the way Admin's drafts date
// Era, and how high it got.

import { findClip, loadChartSongs, songKey } from './drafts.js'
import { stripVariant } from './deezer.js'
import { SONG_LIMITS } from './customGames.js'

const THIS_YEAR = new Date().getFullYear()
export const FIRST_YEAR = 1900

let chartIndex = null

/** The Hot 100's entry for a song, or null when it never charted. */
export async function chartEntry(title, artist) {
  chartIndex ||= loadChartSongs().then((rows) => {
    const index = new Map()
    for (const song of rows) {
      const key = songKey(song.title, song.artist)
      const seen = index.get(key)
      // A title charting twice (a re-release) keeps its best run.
      if (!seen || song.peak < seen.peak) index.set(key, song)
    }
    return index
  })
  return (await chartIndex).get(songKey(title, artist)) || null
}

/**
 * A round for `slug`, from a search result and what was found for it. `from`
 * says where the answer came from, for the builder to show: 'chart' (the Hot
 * 100), 'store' (a store's release year, which can be a reissue's), or
 * 'none'. The database keeps only the fields a game reads, so `from` stays
 * here.
 */
export function roundFrom(slug, track, clip, chart) {
  const song = {
    title: stripVariant(track.title),
    artist: track.artist,
    audio_url: clip.audio_url,
    artwork_url: clip.artwork_url || track.artworkUrl || null,
  }
  if (slug === 'one-bar') return song
  // Era and Hit or Miss only show the title, so a tag goes: "Dreams (2004
  // Remaster)" beside a 1977 answer would read as a wrong year.
  song.title = taggedTitle(song.title) || song.title
  const year = chart?.year ?? clip.storeYear ?? null
  if (slug === 'era') return { ...song, year, from: chart ? 'chart' : year ? 'store' : 'none' }
  return {
    ...song,
    year,
    peak: chart?.peak ?? 0,
    weeks_on_chart: chart?.weeks ?? null,
    weeks_at_one: chart?.weeksAtOne ?? null,
    from: chart ? 'chart' : 'none',
  }
}

/** A picked song made ready for a game, or null when Apple has no clip of it. */
export async function prepareSong(slug, track) {
  const title = stripVariant(track.title)
  const [clip, chart] = await Promise.all([
    findClip(title, track.artist),
    slug === 'one-bar' ? null : chartEntry(title, track.artist),
  ])
  return clip ? roundFrom(slug, track, clip, chart) : null
}

/**
 * The plain title under a One Bar answer that still carries a tag, like
 * "Dreams (2004 Remaster)", or null when there's none. One Bar holds a guess
 * to the answer's title once the usual "(Remastered)" kind of tag is gone,
 * so a friend who picks the plain "Dreams" would be told it's wrong.
 */
export function taggedTitle(title) {
  const plain = (title || '').replace(/\s*[([].*$/, '').replace(/\s+-\s+.*$/, '').trim()
  return plain && plain !== title.trim() ? plain : null
}

/** The same song twice in one game, under any credit or version. */
export function sameSong(a, b) {
  return songKey(a.title, a.artist) === songKey(b.title, b.artist)
}

export function validYear(year) {
  const n = Number(year)
  return Number.isInteger(n) && n >= FIRST_YEAR && n <= THIS_YEAR + 1
}

export function validPeak(peak) {
  const n = Number(peak)
  return peak !== '' && peak != null && Number.isInteger(n) && n >= 0 && n <= 100
}

/** What still stands between a game and saving it, or null when it's ready. */
export function whatsMissing(slug, songs) {
  const { min } = SONG_LIMITS[slug]
  if (songs.length < min) {
    if (min === 1) return 'Pick a song'
    const left = min - songs.length
    return `Pick ${left} more song${left === 1 ? '' : 's'}`
  }
  const noYear = slug === 'era' && songs.find(s => !validYear(s.year))
  if (noYear) return `Add the year for "${noYear.title}"`
  const noPeak = slug === 'hit-or-miss' && songs.find(s => !validPeak(s.peak))
  if (noPeak) return `Fix the peak for "${noPeak.title}"`
  return null
}

/** The rounds as the database takes them: only what a game reads. */
export function toRounds(slug, songs) {
  return songs.map(({ from, ...song }) => {
    if (slug === 'era') return { ...song, year: Number(song.year) }
    if (slug === 'hit-or-miss') {
      const peak = Number(song.peak)
      // A peak changed by hand drops the chart's weeks: they were the other
      // peak's.
      const chartRun = from === 'chart'
      return {
        ...song,
        year: validYear(song.year) ? Number(song.year) : null,
        peak,
        weeks_on_chart: peak && chartRun ? song.weeks_on_chart : null,
        weeks_at_one: peak === 1 && chartRun ? song.weeks_at_one : null,
      }
    }
    return song
  })
}
