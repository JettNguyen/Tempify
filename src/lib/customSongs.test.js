import { describe, it, expect } from 'vitest'
import { roundFrom, whatsMissing, toRounds, validYear, validPeak, sameSong, taggedTitle } from './customSongs.js'

const track = { title: 'Dreams (Remastered)', artist: 'Fleetwood Mac', artworkUrl: 'https://cdn-images.dzcdn.net/a.jpg' }
const clip = { audio_url: 'https://audio-ssl.itunes.apple.com/a.m4a', artwork_url: 'https://is1-ssl.mzstatic.com/a.jpg', storeYear: 2004 }
const chart = { title: 'Dreams', artist: 'Fleetwood Mac', peak: 1, weeks: 16, weeksAtOne: 1, year: 1977 }

describe('a picked song as a round', () => {
  it('dates Era by the chart, not the store', () => {
    expect(roundFrom('era', track, clip, chart)).toEqual({
      title: 'Dreams',
      artist: 'Fleetwood Mac',
      audio_url: clip.audio_url,
      artwork_url: clip.artwork_url,
      year: 1977,
      from: 'chart',
    })
    // Off the chart, the store's year stands in, marked to be checked.
    expect(roundFrom('era', track, clip, null)).toMatchObject({ year: 2004, from: 'store' })
    expect(roundFrom('era', track, { ...clip, storeYear: null }, null)).toMatchObject({ year: null, from: 'none' })
  })

  it("gives Hit or Miss the chart's peak, or never charted", () => {
    expect(roundFrom('hit-or-miss', track, clip, chart)).toMatchObject({ peak: 1, weeks_on_chart: 16, weeks_at_one: 1, from: 'chart' })
    expect(roundFrom('hit-or-miss', track, clip, null)).toMatchObject({ peak: 0, weeks_on_chart: null, from: 'none' })
  })

  it("keeps One Bar's answer the way the guess search writes it", () => {
    expect(roundFrom('one-bar', track, clip, null)).toEqual({
      title: 'Dreams',
      artist: 'Fleetwood Mac',
      audio_url: clip.audio_url,
      artwork_url: clip.artwork_url,
    })
  })

  it('drops a tag from a title Era and Hit or Miss only show', () => {
    const tagged = { ...track, title: 'Dreams (2004 Remaster)' }
    expect(roundFrom('era', tagged, clip, chart).title).toBe('Dreams')
    expect(roundFrom('hit-or-miss', tagged, clip, chart).title).toBe('Dreams')
    expect(roundFrom('one-bar', tagged, clip, null).title).toBe('Dreams (2004 Remaster)')
  })

  it("falls back to the search's art", () => {
    expect(roundFrom('one-bar', track, { ...clip, artwork_url: null }, null).artwork_url).toBe(track.artworkUrl)
  })
})

describe("a One Bar answer friends can match", () => {
  it('flags a title the guess check would hold to the letter', () => {
    expect(taggedTitle('Dreams (2004 Remaster)')).toBe('Dreams')
    expect(taggedTitle('Go Your Own Way - 2004 Remaster')).toBe('Go Your Own Way')
    expect(taggedTitle('Dreams')).toBe(null)
  })
})

describe('what a game still needs', () => {
  const song = (fields) => ({ title: 'Dreams', artist: 'Fleetwood Mac', ...fields })

  it('counts the songs left to pick', () => {
    expect(whatsMissing('era', [])).toBe('Pick 3 more songs')
    expect(whatsMissing('hit-or-miss', [song({ peak: 1 }), song({ peak: 2 })])).toBe('Pick 1 more song')
    expect(whatsMissing('one-bar', [])).toBe('Pick a song')
  })

  it('names the song missing its answer', () => {
    expect(whatsMissing('era', [song({ year: 1977 }), song({ year: '' }), song({ year: 1990 })]))
      .toBe('Add the year for "Dreams"')
    expect(whatsMissing('hit-or-miss', [song({ peak: 1 }), song({ peak: '' }), song({ peak: 0 })]))
      .toBe('Fix the peak for "Dreams"')
  })

  it('lets a full game save', () => {
    expect(whatsMissing('era', [song({ year: 1977 }), song({ year: 1985 }), song({ year: 1990 })])).toBe(null)
    expect(whatsMissing('one-bar', [song()])).toBe(null)
  })

  it('takes years and peaks the database takes', () => {
    expect(validYear(1977)).toBe(true)
    expect(validYear(1850)).toBe(false)
    expect(validYear('')).toBe(false)
    expect(validPeak(0)).toBe(true)
    expect(validPeak(100)).toBe(true)
    expect(validPeak(101)).toBe(false)
    expect(validPeak('')).toBe(false)
    expect(validPeak(null)).toBe(false)
  })
})

describe('the rounds that get saved', () => {
  it('leaves out where an answer came from', () => {
    const [round] = toRounds('era', [{ title: 'Dreams', artist: 'Fleetwood Mac', year: '1977', from: 'chart' }])
    expect(round).toEqual({ title: 'Dreams', artist: 'Fleetwood Mac', year: 1977 })
  })

  it("drops the chart's weeks from a peak changed by hand", () => {
    const changed = toRounds('hit-or-miss', [{ title: 'Dreams', artist: 'Fleetwood Mac', peak: 4, weeks_on_chart: 16, weeks_at_one: 1, from: 'hand' }])
    expect(changed[0]).toMatchObject({ peak: 4, weeks_on_chart: null, weeks_at_one: null })
    const kept = toRounds('hit-or-miss', [{ title: 'Dreams', artist: 'Fleetwood Mac', peak: 1, weeks_on_chart: 16, weeks_at_one: 1, from: 'chart' }])
    expect(kept[0]).toMatchObject({ peak: 1, weeks_on_chart: 16, weeks_at_one: 1 })
  })
})

describe('the same song twice', () => {
  it('matches across a credit and a version', () => {
    expect(sameSong({ title: 'Old Town Road', artist: 'Lil Nas X' }, { title: 'Old Town Road (Remix)', artist: 'Lil Nas X Featuring Billy Ray Cyrus' })).toBe(true)
    expect(sameSong({ title: 'Dreams', artist: 'Fleetwood Mac' }, { title: 'Dreams', artist: 'The Cranberries' })).toBe(false)
  })
})
