import { supabase } from './supabase'
import { todayEST } from './date'
import { getPuzzleArtworkUrls, prefetchArtworkUrls } from './artwork'

export async function getPuzzle(gameSlug, date) {
  const target = date || todayEST()
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
  prefetchArtworkUrls(getPuzzleArtworkUrls(puzzle))
  return puzzle
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
