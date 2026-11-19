import { supabase } from './supabase'
import { todayEST } from './date'
import { getPuzzleArtworkUrls, prefetchArtworkUrls } from './artwork'
import { remember } from './remember'

// Puzzles for a given day don't change while the app is open, so hold them for
// the session. Warming this from the home screen makes opening a game instant.
// A few weeks of the archive's days at most: one dropped is fetched again.
const puzzleCache = new Map()
const PUZZLE_KEEP = 120

const cacheKey = (gameSlug, date) => `${gameSlug}|${date}`

export function getCachedPuzzle(gameSlug, date) {
  return puzzleCache.get(cacheKey(gameSlug, date || todayEST())) ?? null
}

export async function getPuzzle(gameSlug, date) {
  const target = date || todayEST()

  const cached = puzzleCache.get(cacheKey(gameSlug, target))
  if (cached) return cached

  const { data, error } = await supabase
    .from('puzzles')
    .select('*')
    .eq('game_slug', gameSlug)
    .eq('scheduled_date', target)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  if (!data || data.length === 0) throw new Error('No puzzle found')
  const puzzle = data[0]
  remember(puzzleCache, cacheKey(gameSlug, target), puzzle, PUZZLE_KEEP)
  prefetchArtworkUrls(getPuzzleArtworkUrls(puzzle))
  return puzzle
}

// Pull every puzzle for a date into the cache in one query, and hand the rows
// back so the caller doesn't need a second round trip for the same data.
export async function prefetchPuzzlesForDate(date) {
  const target = date || todayEST()
  try {
    const puzzles = await getPuzzlesForDate(target)
    puzzles.forEach((p) => {
      const key = cacheKey(p.game_slug, target)
      if (!puzzleCache.has(key)) remember(puzzleCache, key, p, PUZZLE_KEEP)
    })
    return puzzles
  } catch {
    // A cold open just falls back to fetching per game.
    return []
  }
}

export async function getPuzzlesForDate(date) {
  const target = date || todayEST()
  const { data, error } = await supabase
    .from('puzzles')
    .select('*')
    .eq('scheduled_date', target)
  if (error) throw error
  const puzzles = data || []
  prefetchArtworkUrls(puzzles.flatMap((p) => getPuzzleArtworkUrls(p)))
  return puzzles
}

/**
 * Whether each of these days' Cover or Not was a cover with a year question,
 * as the bits of its puzzle `hasYearQuestion` reads, keyed
 * `cover-or-not|<date>`. A profile measures its plays with them. Empty when
 * the lookup fails, so the plays are measured out of 1,000 instead.
 */
export async function getCoverPuzzles(dates) {
  if (!dates?.length) return {}
  const { data, error } = await supabase
    .from('puzzles')
    .select('scheduled_date, answer, original_year:metadata->original_year')
    .eq('game_slug', 'cover-or-not')
    .in('scheduled_date', dates)
  if (error) {
    console.warn('[Tempify] getCoverPuzzles failed:', error.message)
    return {}
  }
  return Object.fromEntries((data || []).map(p => [
    `cover-or-not|${p.scheduled_date}`,
    { answer: p.answer, metadata: { original_year: p.original_year } },
  ]))
}
