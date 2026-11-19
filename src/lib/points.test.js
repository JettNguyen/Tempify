import { describe, it, expect } from 'vitest'
import { ACCURACY_GAMES, FIVE_SONG_MAX, dayAccuracy, dayMax, closeness, oneBarPoints, playPoints, gameMax, dayTally, rankByPoints } from './points.js'

describe('dayAccuracy', () => {
  it('is a five-song day out of 5,000', () => {
    expect(FIVE_SONG_MAX).toBe(5000)
    expect(dayAccuracy(4060)).toBeCloseTo(0.812)
    expect(dayAccuracy(5000)).toBe(1)
  })

  it('stays between none and all of it', () => {
    expect(dayAccuracy(0)).toBe(0)
    expect(dayAccuracy(null)).toBe(0)
    expect(dayAccuracy(5200)).toBe(1)
  })

  it('measures a three-song day out of 3,000', () => {
    expect(dayAccuracy(2400, 3000)).toBeCloseTo(0.8)
    expect(dayMax('hit-or-miss', '2026-11-17')).toBe(3000)
    expect(dayMax('tempo', '2026-11-17')).toBe(3000)
    expect(dayMax('hit-or-miss', '2026-11-16')).toBe(5000)
    expect(dayMax('era', '2026-11-17')).toBe(4000)
  })

  it('covers the games played in rounds, not Cover or Not or One Bar', () => {
    expect([...ACCURACY_GAMES].sort()).toEqual(['era', 'hit-or-miss', 'tempo'])
  })
})

describe('closeness', () => {
  it('is all of it within the full-marks window and none from the far end', () => {
    expect(closeness(0, 1)).toBe(1)
    expect(closeness(0.02, 0.2, 0.03)).toBe(1)
    expect(closeness(1, 1)).toBe(0)
    expect(closeness(2, 1)).toBe(0)
  })

  it('costs little for the first misses and more as they grow', () => {
    const first = 1 - closeness(0.1, 1)
    const later = closeness(0.5, 1) - closeness(0.6, 1)
    expect(first).toBeLessThan(later)
  })
})

describe('oneBarPoints', () => {
  it('is 1,000 on the first guess and 200 less a guess, 100 on the last', () => {
    expect([1, 2, 3, 4, 5, 6].map(oneBarPoints)).toEqual([1000, 800, 600, 400, 200, 100])
  })

  it('is nothing for a miss', () => {
    expect(oneBarPoints(0)).toBe(0)
    expect(oneBarPoints(null)).toBe(0)
  })
})

describe('playPoints', () => {
  it('takes the points a play saved', () => {
    expect(playPoints('era', { points: 3420, completed: true })).toBe(3420)
    expect(playPoints('one-bar', { points: 600, attempts: 3, completed: true })).toBe(600)
  })

  it("works out One Bar's from its guesses when it saved none", () => {
    expect(playPoints('one-bar', { attempts: 2, completed: true })).toBe(800)
    expect(playPoints('one-bar', { attempts: 6, completed: false })).toBe(0)
  })

  it('makes a right call on an old one-song day worth a song', () => {
    expect(playPoints('hit-or-miss', { attempts: 1, completed: true })).toBe(1000)
    expect(playPoints('sampled', { attempts: 1, completed: false })).toBe(0)
    expect(playPoints('era', null)).toBe(0)
  })
})

describe('gameMax', () => {
  const cover = { answer: 'cover', metadata: { original_year: 1969 } }
  const original = { answer: 'original', metadata: {} }

  it('gives Cover or Not 2,000 on a cover and 1,000 on an original', () => {
    expect(gameMax('cover-or-not', '2026-11-19', cover)).toBe(2000)
    expect(gameMax('cover-or-not', '2026-11-19', original)).toBe(1000)
  })

  it('counts the scored songs in a day of rounds, Era\'s first being on the line', () => {
    const rounds = (n) => ({ metadata: { rounds: Array.from({ length: n }, () => ({})) } })
    expect(gameMax('era', '2026-11-19', rounds(5))).toBe(4000)
    expect(gameMax('hit-or-miss', '2026-11-19', rounds(3))).toBe(3000)
    expect(gameMax('hit-or-miss', '2026-11-19', null)).toBe(3000)
    expect(gameMax('hit-or-miss', '2026-10-01', { metadata: {} })).toBe(1000)
  })

  it('gives One Bar 1,000', () => {
    expect(gameMax('one-bar', '2026-11-19')).toBe(1000)
  })

  it('falls back to the day\'s song count without a puzzle', () => {
    expect(gameMax('era', '2026-11-19')).toBe(4000)
    expect(gameMax('tempo', '2026-11-19')).toBe(3000)
  })
})

describe('dayTally', () => {
  const slugs = ['one-bar', 'hit-or-miss', 'era', 'cover-or-not', 'tempo']
  const date = '2026-11-19'

  it('adds up only the games played, out of what they could have given', () => {
    const tally = dayTally(slugs, {
      'one-bar': { attempts: 3, completed: true },
      tempo: { points: 2100, completed: true },
    }, {}, date)
    expect(tally).toEqual({ points: 2700, max: 4000, played: 2 })
  })

  it("never counts an unplayed Cover or Not's top", () => {
    const puzzles = { 'cover-or-not': { answer: 'cover', metadata: { original_year: 1969 } } }
    expect(dayTally(slugs, {}, puzzles, date)).toEqual({ points: 0, max: 0, played: 0 })
    const played = dayTally(slugs, { 'cover-or-not': { points: 1700, completed: true } }, puzzles, date)
    expect(played.max).toBe(2000)
  })

  it('keeps the top at least the points, when the puzzle did not load', () => {
    const tally = dayTally(slugs, { 'cover-or-not': { points: 1800, completed: true } }, {}, date)
    expect(tally.max).toBe(1800)
  })
})

describe('rankByPoints', () => {
  it('puts the most points first and shares a place on a tie', () => {
    const ranked = rankByPoints([
      { name: 'sam', points: 600 },
      { name: 'dana', points: 800 },
      { name: 'todd', points: 600 },
      { name: 'ellen', points: 0 },
    ])
    expect(ranked.map(e => [e.name, e.place])).toEqual([['dana', 1], ['sam', 2], ['todd', 2], ['ellen', 4]])
  })

  it('breaks a tie by time in a timed game', () => {
    const ranked = rankByPoints([
      { name: 'sam', points: 1000, timeSeconds: 9 },
      { name: 'dana', points: 1000, timeSeconds: 4 },
      { name: 'mike', points: 1000, timeSeconds: null },
    ], { timed: true })
    expect(ranked.map(e => [e.name, e.place])).toEqual([['dana', 1], ['sam', 2], ['mike', 3]])
  })

  it('ignores time in an untimed game', () => {
    const ranked = rankByPoints([
      { name: 'sam', points: 800, timeSeconds: 9 },
      { name: 'dana', points: 800, timeSeconds: 4 },
    ])
    expect(ranked.map(e => e.place)).toEqual([1, 1])
  })
})
