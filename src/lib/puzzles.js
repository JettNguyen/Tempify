import { supabase } from './supabase'

export async function getPuzzle(gameSlug, date) {
  const target = date || new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('puzzles')
    .select('*')
    .eq('game_slug', gameSlug)
    .eq('scheduled_date', target)
    .single()
  if (error) throw error
  return data
}

export async function getPuzzlesForDate(date) {
  const target = date || new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('puzzles')
    .select('*')
    .eq('scheduled_date', target)
  if (error) throw error
  return data || []
}
