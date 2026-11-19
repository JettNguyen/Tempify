import { describe, it, expect } from 'vitest'
import { profileStats, coverDatesToCheck } from './profileStats.js'
import { playMax } from './points.js'

const play = (game_slug, date_played, fields) => ({ game_slug, date_played, attempts: 1, ...fields })

describe('playMax', () => {
  it("measures a play saved without points out of 1,000", () => {
    expect(playMax('era', { date_played: '2026-10-20', completed: true })).toBe(1000)
    expect(playMax('one-bar', { date_played: '2026-10-20', attempts: 2, completed: true })).toBe(1000)
  })

  it("measures a day of rounds out of its scored songs", () => {
    expect(playMax('era', { date_played: '2026-11-18', points: 3000 })).toBe(4000)
    expect(playMax('tempo', { date_played: '2026-11-18', points: 2000 })).toBe(3000)
    expect(playMax('hit-or-miss', { date_played: '2026-11-10', points: 2000 })).toBe(5000)
  })

  it("needs Cover or Not's puzzle to know a cover's 2,000", () => {
    const cover = { answer: 'cover', metadata: { original_year: 1969 } }
    expect(playMax('cover-or-not', { date_played: '2026-11-18', points: 1000 }, cover)).toBe(2000)
    expect(playMax('cover-or-not', { date_played: '2026-11-18', points: 1000 })).toBe(1000)
    expect(playMax('cover-or-not', { date_played: '2026-11-18', points: 1600 })).toBe(1600)
  })
})

describe('profileStats', () => {
  const scores = [
    play('one-bar', '2026-11-18', { attempts: 2, completed: true }),
    play('era', '2026-11-18', { points: 3000, completed: true }),
    play('cover-or-not', '2026-11-18', { points: 1500, completed: true }),
    play('one-bar', '2026-11-17', { attempts: 6, completed: false, points: 0 }),
    play('tempo', '2026-11-17', { points: 2400, completed: true }),
  ]
  const puzzles = { 'cover-or-not|2026-11-18': { answer: 'cover', metadata: { original_year: 1969 } } }

  it('is nothing before the first play', () => {
    expect(profileStats([])).toBeNull()
  })

  it('adds up the points, the days, and the best day', () => {
    const stats = profileStats(scores, [], puzzles)
    expect(stats.total).toBe(850 + 3000 + 1500 + 0 + 2400)
    expect(stats.daysPlayed).toBe(2)
    expect(stats.bestDay).toMatchObject({ date: '2026-11-18', points: 5350 })
  })

  it('measures every game the same way, out of what its days offered', () => {
    const byGame = Object.fromEntries(profileStats(scores, [], puzzles).byGame.map(g => [g.slug, g]))
    expect(byGame['one-bar']).toMatchObject({ days: 2, avgPoints: 425, bestPoints: 850 })
    expect(byGame['one-bar'].share).toBeCloseTo(0.425)
    expect(byGame.era.share).toBeCloseTo(0.75)
    expect(byGame['cover-or-not'].share).toBeCloseTo(0.75)
    expect(byGame.tempo.share).toBeCloseTo(0.8)
    expect(byGame['hit-or-miss']).toBeUndefined()
  })

  it('lists the latest days first, each with its lineup', () => {
    const { recentDays } = profileStats(scores, [], puzzles)
    expect(recentDays.map(d => d.date)).toEqual(['2026-11-18', '2026-11-17'])
    expect(recentDays[1]).toMatchObject({ points: 2400 })
    expect(recentDays[0].lineup).toContain('tempo')
  })

  it('takes the longest streak of any game', () => {
    const streaks = [
      { game_slug: 'era', longest_streak: 3 },
      { game_slug: 'hit-or-miss', longest_streak: 7 },
    ]
    expect(profileStats(scores, streaks).bestStreak).toEqual({ days: 7, slug: 'hit-or-miss' })
  })

  it('keeps the earlier of two best days that tie', () => {
    const tied = [play('era', '2026-11-18', { points: 2000 }), play('era', '2026-11-16', { points: 2000 })]
    expect(profileStats(tied).bestDay.date).toBe('2026-11-16')
  })
})

describe('coverDatesToCheck', () => {
  it("only asks for Cover or Not days that saved points", () => {
    expect(coverDatesToCheck([
      play('cover-or-not', '2026-11-18', { points: 1000 }),
      play('cover-or-not', '2026-10-20', { completed: true }),
      play('era', '2026-11-18', { points: 3000 }),
    ])).toEqual(['2026-11-18'])
  })
})
