import { supabase } from './supabase'
import { todayEST } from './date'

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
  return data[0]
}

export async function getPuzzlesForDate(date) {
  const target = date || todayEST()
  const { data, error } = await supabase
    .from('puzzles')
    .select('*')
    .eq('scheduled_date', target)
  if (error) throw error
  return data || []
}
