import { supabase } from './supabase'
import { todayEST, yesterdayEST } from './date'

export async function saveScore({ userId, gameSlug, attempts, completed, timeSeconds }) {
  await supabase.from('scores').insert({
    user_id: userId,
    game_slug: gameSlug,
    date_played: todayEST(),
    attempts,
    completed,
    time_seconds: timeSeconds ?? null,
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

// ─── Streaks ──────────────────────────────────────────────────────────────────

const FREEZE_TOKENS_PER_MONTH = 2

async function consumeFreeze(userId, gameSlug) {
  const month = todayEST().slice(0, 7) // 'YYYY-MM'

  const { data: existing } = await supabase
    .from('streak_freezes')
    .select('*')
    .eq('user_id', userId)
    .eq('game_slug', gameSlug)
    .eq('month', month)
    .single()

  const used = existing?.tokens_used ?? 0
  if (used >= FREEZE_TOKENS_PER_MONTH) return false

  if (existing) {
    await supabase
      .from('streak_freezes')
      .update({ tokens_used: used + 1 })
      .eq('id', existing.id)
  } else {
    await supabase.from('streak_freezes').insert({
      user_id: userId,
      game_slug: gameSlug,
      month,
      tokens_used: 1,
    })
  }
  return true
}

export async function updateStreak(userId, gameSlug, isPremium = false) {
  const today = todayEST()

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

  const yesterday = yesterdayEST()
  const continued = existing.last_played_date === yesterday
  const alreadyPlayedToday = existing.last_played_date === today

  if (alreadyPlayedToday) return

  let newCurrent
  if (continued) {
    newCurrent = existing.current_streak + 1
  } else {
    // Gap detected — try auto-freeze for premium users
    const frozen = isPremium ? await consumeFreeze(userId, gameSlug) : false
    newCurrent = frozen ? existing.current_streak + 1 : 1
  }

  const newLongest = Math.max(newCurrent, existing.longest_streak)

  await supabase
    .from('streaks')
    .update({ current_streak: newCurrent, longest_streak: newLongest, last_played_date: today })
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

export async function getFreezesRemaining(userId, gameSlug) {
  const month = todayEST().slice(0, 7)
  const { data } = await supabase
    .from('streak_freezes')
    .select('tokens_used')
    .eq('user_id', userId)
    .eq('game_slug', gameSlug)
    .eq('month', month)
    .single()
  return FREEZE_TOKENS_PER_MONTH - (data?.tokens_used ?? 0)
}

// ─── Follows ──────────────────────────────────────────────────────────────────

export async function followUser(followerId, followingId) {
  await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId })
}

export async function unfollowUser(followerId, followingId) {
  await supabase.from('follows').delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
}

export async function getFollowing(userId) {
  const { data } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)
  return (data || []).map(r => r.following_id)
}

export async function getFollowers(userId) {
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', userId)
  return (data || []).map(r => r.follower_id)
}

export async function isFollowing(followerId, followingId) {
  const { data } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .single()
  return !!data
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

// Returns leaderboard entries for a specific puzzle date + game.
// scope: 'friends' (people userId follows) | 'global' (all public users)
export async function getLeaderboard(userId, gameSlug, date, scope = 'friends') {
  let eligibleUserIds = []

  if (scope === 'friends') {
    if (!userId) return []
    const following = await getFollowing(userId)
    // Include the current user alongside people they follow
    const candidateIds = [...new Set([userId, ...following])]
    // Filter to those who allow leaderboard visibility (current user always included)
    const { data: users } = await supabase
      .from('users')
      .select('id, leaderboard_visibility')
      .in('id', candidateIds)
    eligibleUserIds = (users || [])
      .filter(u => u.id === userId || ['followers', 'public'].includes(u.leaderboard_visibility))
      .map(u => u.id)
  } else {
    // global — users who opted into public
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('leaderboard_visibility', 'public')
    eligibleUserIds = (users || []).map(u => u.id)
  }

  if (eligibleUserIds.length === 0) return []

  const { data: scores, error } = await supabase
    .from('scores')
    .select('user_id, attempts, completed, time_seconds')
    .eq('game_slug', gameSlug)
    .eq('date_played', date)
    .eq('completed', true)
    .in('user_id', eligibleUserIds)

  if (error) { console.error('[leaderboard] scores query failed:', error.message); return [] }
  if (!scores?.length) return []

  const userIds = [...new Set(scores.map(s => s.user_id))]
  const { data: profiles } = await supabase
    .from('users')
    .select('id, username, avatar_icon, avatar_color')
    .in('id', userIds)

  const profileMap = {}
  ;(profiles || []).forEach(p => { profileMap[p.id] = p })

  const entries = scores.map(s => ({
    userId: s.user_id,
    username: profileMap[s.user_id]?.username || 'anonymous',
    avatarIcon: profileMap[s.user_id]?.avatar_icon,
    avatarColor: profileMap[s.user_id]?.avatar_color,
    attempts: s.attempts,
    timeSeconds: s.time_seconds,
  }))

  if (gameSlug === 'one-bar') {
    entries.sort((a, b) => a.attempts - b.attempts)
  } else {
    entries.sort((a, b) => (a.timeSeconds ?? Infinity) - (b.timeSeconds ?? Infinity))
  }

  return entries
}

// ─── User search ──────────────────────────────────────────────────────────────

export async function searchUsers(query) {
  if (!query || query.trim().length < 2) return []
  const q = query.trim().toLowerCase()
  const { data } = await supabase
    .from('users')
    .select('id, username, avatar_icon, avatar_color')
    .or(`username.ilike.%${q}%,email.ilike.%${q}%`)
    .limit(10)
  return data || []
}
