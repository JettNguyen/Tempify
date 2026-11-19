import { ALL_GAMES, getGameSlugsForDate } from './games.js'
import { playPoints, playMax } from './points.js'

// What a profile says about how someone plays, all of it in points: the
// total, the best day, each game measured the same way, and the latest days.

const RECENT_DAYS = 7

function average(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
}

/**
 * `scores` are a player's saved plays, `streaks` their streak rows, and
 * `puzzles` the puzzles worth knowing to measure a play, keyed
 * `<slug>|<date>` (Cover or Not's, to tell a cover's 2,000 from an
 * original's 1,000). Null before the first play.
 */
export function profileStats(scores, streaks = [], puzzles = {}) {
  if (!scores?.length) return null

  // Each day played: its points across its games.
  const byDate = new Map()
  for (const s of scores) {
    const day = byDate.get(s.date_played) || { date: s.date_played, points: 0, slugs: [] }
    day.points += playPoints(s.game_slug, s)
    day.slugs.push(s.game_slug)
    byDate.set(s.date_played, day)
  }
  const days = [...byDate.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(day => ({ ...day, lineup: getGameSlugsForDate(day.date) }))

  // The highest, and the earlier of two that tie, since that one got there first.
  const bestDay = days.reduce((best, day) => (!best || day.points >= best.points ? day : best), null)

  const longest = streaks.reduce((best, s) => ((s.longest_streak || 0) > (best?.longest_streak || 0) ? s : best), null)
  const bestStreak = longest ? { days: longest.longest_streak, slug: longest.game_slug } : null

  // Every game measured the same way: how much of what each day offered it
  // got, on average. Retired games stay, so their history isn't lost.
  const byGame = ALL_GAMES.map(game => {
    const plays = scores.filter(s => s.game_slug === game.slug)
    if (!plays.length) return null
    const points = plays.map(p => playPoints(game.slug, p))
    const shares = plays.map((p, i) => {
      const top = playMax(game.slug, p, puzzles[`${game.slug}|${p.date_played}`])
      return top > 0 ? points[i] / top : 0
    })
    return {
      slug: game.slug,
      name: game.name,
      days: plays.length,
      share: average(shares),
      avgPoints: average(points),
      bestPoints: Math.max(...points),
    }
  }).filter(Boolean)

  return {
    total: days.reduce((sum, day) => sum + day.points, 0),
    daysPlayed: days.length,
    bestDay,
    bestStreak,
    byGame,
    recentDays: days.slice(0, RECENT_DAYS),
  }
}

/** The dates whose Cover or Not puzzle a profile needs, to measure plays scored out of 2,000 or 1,000. */
export function coverDatesToCheck(scores) {
  return [...new Set(
    (scores || [])
      .filter(s => s.game_slug === 'cover-or-not' && s.points != null)
      .map(s => s.date_played),
  )]
}
