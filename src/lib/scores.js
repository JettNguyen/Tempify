import { supabase } from './supabase'

export async function saveScore({ userId, gameSlug, attempts, completed }) {
  const today = new Date().toISOString().split('T')[0]
  await supabase.from('scores').insert({
    user_id: userId,
    game_slug: gameSlug,
    date_played: today,
    attempts,
    completed,
  })
}

export async function getRecentScores(userId, limit = 20) {
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function getScoresForMonth(userId, year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end = new Date(year, month, 0).toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .eq('user_id', userId)
    .gte('date_played', start)
    .lte('date_played', end)
  if (error) throw error
  return data || []
}

export async function updateStreak(userId, gameSlug) {
  const today = new Date().toISOString().split('T')[0]

  const { data: existing } = await supabase
    .from('streaks')
    .select('*')
    .eq('user_id', userId)
    .eq('game_slug', gameSlug)
    .single()

  if (!existing) {
    await supabase.from('streaks').insert({
      user_id: userId,
      game_slug: gameSlug,
      current_streak: 1,
      longest_streak: 1,
      last_played_date: today,
    })
    return
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  const continued = existing.last_played_date === yesterdayStr
  const newCurrent = continued ? existing.current_streak + 1 : 1
  const newLongest = Math.max(newCurrent, existing.longest_streak)

  await supabase
    .from('streaks')
    .update({
      current_streak: newCurrent,
      longest_streak: newLongest,
      last_played_date: today,
    })
    .eq('id', existing.id)
}

export async function getStreaks(userId) {
  const { data, error } = await supabase
    .from('streaks')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  return data || []
}
