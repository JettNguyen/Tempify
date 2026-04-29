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
        map[row.game_slug] = { attempts: row.attempts, completed: row.completed }
      })
      // Supabase is authoritative; write back to localStorage to keep in sync
      writeLocal(userId, map)
      setCompletions(prev => ({ ...prev, ...map }))
    }
  }

  function markComplete(gameSlug, attempts) {
    const updated = { ...completions, [gameSlug]: { attempts, completed: true } }
    setCompletions(updated)
    writeLocal(userId, updated) // scoped per user for instant restore on navigation
  }

  function isComplete(gameSlug) {
    return completions[gameSlug]?.completed === true
  }

  return { completions, markComplete, isComplete }
}
