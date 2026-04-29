import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { todayEST } from '../lib/date'

const storageKey = () => `tempify_completions_${todayEST()}`

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(storageKey()) || '{}')
  } catch {
    return {}
  }
}

function writeLocal(data) {
  localStorage.setItem(storageKey(), JSON.stringify(data))
}

export function useCompletion(userId) {
  const [completions, setCompletions] = useState({})

  useEffect(() => {
    if (userId) {
      loadFromSupabase()
    } else {
      setCompletions(readLocal())
    }
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
      setCompletions(map)
    }
  }

  function markComplete(gameSlug, attempts) {
    const updated = { ...completions, [gameSlug]: { attempts, completed: true } }
    setCompletions(updated)
    if (!userId) writeLocal(updated)
  }

  function isComplete(gameSlug) {
    return completions[gameSlug]?.completed === true
  }

  return { completions, markComplete, isComplete }
}
