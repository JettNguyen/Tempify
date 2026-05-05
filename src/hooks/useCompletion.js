import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { todayEST } from '../lib/date'

// v2: keyed by slug|date so archive and today's puzzles don't collide
const storageKey = (userId) => `tempify_completions_v2_${userId || 'guest'}`

function readLocal(userId) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) || '{}')
  } catch {
    return {}
  }
}

function writeLocal(userId, data) {
  localStorage.setItem(storageKey(userId), JSON.stringify(data))
}

export function useCompletion(userId) {
  const [completions, setCompletions] = useState(() => readLocal(userId))

  useEffect(() => {
    setCompletions(readLocal(userId))
    if (userId) loadFromSupabase()
  }, [userId])

  async function loadFromSupabase() {
    const { data } = await supabase
      .from('scores')
      .select('game_slug, date_played, attempts, completed')
      .eq('user_id', userId)
      .eq('date_played', todayEST())

    if (data) {
      const map = {}
      data.forEach((row) => {
        const key = `${row.game_slug}|${row.date_played}`
        const prev = map[key]
        map[key] = {
          attempts: Math.max(prev?.attempts ?? 0, row.attempts ?? 0),
          completed: Boolean(prev?.completed || row.completed),
          played: true,
        }
      })
      const merged = { ...readLocal(userId), ...map }
      writeLocal(userId, merged)
      setCompletions(prev => ({ ...prev, ...map }))
    }
  }

  function markComplete(gameSlug, puzzleDate, attempts, completed = true) {
    const key = `${gameSlug}|${puzzleDate}`
    const updated = {
      ...completions,
      [key]: { attempts, completed: Boolean(completed), played: true },
    }
    setCompletions(updated)
    writeLocal(userId, updated)
  }

  function isComplete(gameSlug, date) {
    const key = `${gameSlug}|${date}`
    const entry = completions[key]
    return Boolean(entry?.played || (entry?.attempts ?? 0) > 0 || entry?.completed)
  }

  return { completions, markComplete, isComplete }
}
