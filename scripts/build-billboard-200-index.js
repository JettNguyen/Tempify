#!/usr/bin/env node
/**
 * Processes src/assets/billboard-200-current.csv into a compact lookup index.
 * Output: src/assets/billboard-200-index.json
 *
 * Run: node scripts/build-billboard-200-index.js
 *
 * Index format (same as hot-100-index.json, but for albums):
 *   { "normalized title": [["normalized artist", peakPos, weeksAtOne], ...] }
 */

import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CSV  = path.join(__dirname, '../src/assets/billboard-200-current.csv')
const OUT  = path.join(__dirname, '../src/assets/billboard-200-index.json')

function normalize(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Map keyed by "normalTitle|||normalArtist" → { peak, weeksAtOne }
const map = new Map()

const rl = readline.createInterface({ input: fs.createReadStream(CSV) })
let header = true

rl.on('line', (line) => {
  if (header) { header = false; return }

  // chart_week,current_week,title,performer,last_week,peak_pos,wks_on_chart
  const cols = line.split(',')
  if (cols.length < 7) return

  const current  = cols[1].trim()
  const title    = cols[2].trim()
  const artist   = cols[3].trim()
  const peakCol  = cols[5].trim()

  if (!title || !artist || peakCol === 'NA') return

  const peak    = parseInt(peakCol, 10)
  const isAtOne = current === '1'

  if (isNaN(peak)) return

  const key = `${normalize(title)}|||${normalize(artist)}`
  const existing = map.get(key)

  if (!existing) {
    map.set(key, { peak, weeksAtOne: isAtOne ? 1 : 0 })
  } else {
    if (peak < existing.peak) existing.peak = peak
    if (isAtOne) existing.weeksAtOne++
  }
})

rl.on('close', () => {
  const index = {}

  for (const [key, { peak, weeksAtOne }] of map) {
    const sep    = key.indexOf('|||')
    const title  = key.slice(0, sep)
    const artist = key.slice(sep + 3)

    if (!index[title]) index[title] = []
    index[title].push([artist, peak, weeksAtOne])
  }

  for (const entries of Object.values(index)) {
    entries.sort((a, b) => a[1] - b[1])
  }

  fs.writeFileSync(OUT, JSON.stringify(index))
  const titles  = Object.keys(index).length
  const entries = map.size
  console.log(`✓ Built billboard-200 index: ${titles} titles, ${entries} title+artist entries → ${OUT}`)
})
