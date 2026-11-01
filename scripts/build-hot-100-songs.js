#!/usr/bin/env node
/**
 * Every song that has ever charted on the Hot 100, one row each, for Admin's
 * puzzle drafts: Peak needs how high a song went, Timeline needs when it
 * arrived, and both need names that can be searched for a clip.
 *
 * Input is all.json from github.com/mhollingshead/billboard-hot-100, which
 * holds every weekly chart since 8/4/1958 and is refreshed daily. Download it
 * anywhere and pass the path:
 *
 *   curl -L -o all.json https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main/all.json
 *   node scripts/build-hot-100-songs.js path/to/all.json
 *
 * Output: src/assets/hot-100-songs.json, an array of
 *   [title, artist, peak, weeksOnChart, weeksAtOne, firstWeek]
 * with firstWeek as YYYY-MM-DD, sorted by firstWeek.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '../src/assets/hot-100-songs.json')

const input = process.argv[2]
if (!input) {
  console.error('Usage: node scripts/build-hot-100-songs.js path/to/all.json')
  process.exit(1)
}

const charts = JSON.parse(fs.readFileSync(input, 'utf8'))
charts.sort((a, b) => a.date.localeCompare(b.date))

// Keyed on the names as printed, so two songs that only differ in case stay
// apart. Billboard prints one song's name the same way week to week.
const songs = new Map()

for (const { date, data } of charts) {
  for (const entry of data) {
    const title = entry.song?.trim()
    const artist = entry.artist?.trim()
    if (!title || !artist) continue

    const key = `${title}|||${artist}`
    let song = songs.get(key)
    if (!song) {
      song = { title, artist, peak: entry.this_week, weeks: 0, weeksAtOne: 0, firstWeek: date }
      songs.set(key, song)
    }
    song.weeks++
    song.peak = Math.min(song.peak, entry.this_week)
    if (entry.this_week === 1) song.weeksAtOne++
  }
}

const rows = [...songs.values()]
  .sort((a, b) => a.firstWeek.localeCompare(b.firstWeek) || a.peak - b.peak)
  .map(s => [s.title, s.artist, s.peak, s.weeks, s.weeksAtOne, s.firstWeek])

fs.writeFileSync(OUT, JSON.stringify(rows))
const last = charts[charts.length - 1]?.date
console.log(`Built ${rows.length} songs from ${charts.length} charts (through ${last}) → ${OUT}`)
