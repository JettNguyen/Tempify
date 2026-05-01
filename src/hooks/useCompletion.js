import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { todayEST } from '../lib/date'

const storageKey = (userId) => `tempify_completions_${userId || 'guest'}_${todayEST()}`

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
    // Always seed from localStorage first so restore logic works instantly
    setCompletions(readLocal(userId))
    if (userId) loadFromSupabase()
  }, [userId])

  async function loadFromSupabase() {
    const { data } = await supabase
      .from('scores')
      .select('game_slug, attempts, completed')
      .eq('user_id', userId)
      .eq('date_played', todayEST())

    if (data) {
      const map = {}
      data.forEach((row) => {
        const prev = map[row.game_slug]
        map[row.game_slug] = {
          attempts: Math.max(prev?.attempts ?? 0, row.attempts ?? 0),
          completed: Boolean(prev?.completed || row.completed),
          played: true,
        }
      })
      // Supabase is authoritative; write back to localStorage to keep in sync
      writeLocal(userId, map)
      setCompletions(prev => ({ ...prev, ...map }))
    }
  }

  function markComplete(gameSlug, attempts, completed = true) {
    const updated = {
      ...completions,
      [gameSlug]: {
        attempts,
        completed: Boolean(completed),
        played: true,
      },
    }
    setCompletions(updated)
    writeLocal(userId, updated) // scoped per user for instant restore on navigation
  }

  function isComplete(gameSlug) {
    const game = completions[gameSlug]
    return Boolean(game?.played || (game?.attempts ?? 0) > 0 || game?.completed)
  }

  return { completions, markComplete, isComplete }
}
