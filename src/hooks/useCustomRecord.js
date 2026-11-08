import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { readCustomResult, writeCustomResult, saveCustomScore } from '../lib/customGames'

// The board asks a player who isn't signed in to log in, so a game played
// before signing in on this device counts as theirs once they have.
function startingResult(userId, code) {
  if (!code) return null
  const own = readCustomResult(userId, code)
  if (own || !userId) return own
  const guest = readCustomResult(null, code)
  if (!guest?.played) return null
  const adopted = { ...guest, posted: false }
  writeCustomResult(userId, code, adopted)
  return adopted
}

/**
 * How a game a player made remembers being played, in place of
 * useCompletion: on this device, and on the game's scoreboard for a signed-in
 * player who didn't make it. Nothing here touches streaks, daily scores or
 * the play counts. Null for a daily game.
 *
 * `finish` takes what useCompletion keeps ({ attempts, completed, points })
 * plus One Bar's `guesses`.
 */
export function useCustomRecord(custom) {
  const { user } = useAuth()
  const code = custom?.code
  const userId = user?.id
  const [saved, setSaved] = useState(() => startingResult(userId, code))
  // Goes up each time a score reaches the board, so the board reloads.
  const [posted, setPosted] = useState(0)

  async function post(result) {
    try {
      await saveCustomScore(code, result)
      const next = { ...result, posted: true }
      writeCustomResult(userId, code, next)
      setSaved(next)
      setPosted(n => n + 1)
    } catch (err) {
      console.error('[Tempify] Custom game score save error:', err.message)
    }
  }

  // A finish whose score didn't make it up (offline, say, or played before
  // signing in) goes up the next time the game is opened.
  useEffect(() => {
    if (!code || !userId || custom.mine || !saved?.played || saved.posted) return
    post(saved)
  }, [code, userId])

  if (!custom) return null

  return {
    finished: Boolean(saved?.played),
    saved,
    posted,
    finish(result) {
      const next = { ...result, played: true }
      writeCustomResult(userId, code, next)
      setSaved(next)
      if (userId && !custom.mine) post(next)
    },
  }
}
