import { useEffect, useRef, useState } from 'react'
import { fmtPoints } from '../lib/points'
import './DayScore.css'

// The day's points, at the top of the home screen: the answer to "how did you
// do on today's Tempify?". Coming back from a game, the number counts up from
// what it said last time, so the points just earned land where they're seen.

const COUNT_MS = 900
// Long enough for the page to finish coming in, so the count is watched.
const COUNT_DELAY_MS = 200
const seenKey = 'tempify_day_score_seen'

function readSeen(date) {
  try {
    const seen = JSON.parse(localStorage.getItem(seenKey) || 'null')
    return seen?.date === date ? seen.points : null
  } catch {
    return null
  }
}

function writeSeen(date, points) {
  try {
    localStorage.setItem(seenKey, JSON.stringify({ date, points }))
  } catch {
    // Storage blocked: the next visit just shows the number without the count.
  }
}

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Counts up to `target` from the last number shown for that day. Off
 * (`enabled` false) it shows the number as it is and keeps no record, so an
 * archive day never takes the place of today's last number.
 */
function useCountUp(target, date, enabled = true) {
  const [shown, setShown] = useState(() => {
    const seen = enabled ? readSeen(date) : null
    return seen != null && seen < target && !reducedMotion() ? seen : target
  })
  const [landed, setLanded] = useState(false)
  const shownRef = useRef(shown)
  shownRef.current = shown

  useEffect(() => {
    if (enabled) writeSeen(date, target)
    const from = shownRef.current
    if (from === target) return
    // A lower number (another account, say), reduced motion or no count wanted.
    if (!enabled || target < from || reducedMotion()) {
      setShown(target)
      return
    }
    setLanded(false)
    let frame = 0
    let start = 0
    const tick = (now) => {
      if (!start) start = now
      const t = Math.min(1, (now - start) / COUNT_MS)
      setShown(Math.round(from + (target - from) * (1 - (1 - t) ** 3)))
      if (t < 1) frame = requestAnimationFrame(tick)
      else setLanded(true)
    }
    const wait = setTimeout(() => { frame = requestAnimationFrame(tick) }, COUNT_DELAY_MS)
    return () => {
      clearTimeout(wait)
      cancelAnimationFrame(frame)
    }
  }, [target, date, enabled])

  return { shown, landed }
}

/**
 * `points` so far that day, out of `max`, the most the games played so far
 * could have given. `done` is every scheduled game played. `countUp` false
 * shows the number as it is, for a day other than today.
 */
export default function DayScore({ date, points, max, played, done, countUp = true }) {
  const { shown, landed } = useCountUp(points, date, countUp)

  let note = 'Play a game to score'
  if (played) note = done ? `of ${fmtPoints(max)}` : `of ${fmtPoints(max)} so far`

  return (
    <div className={`day-score${played ? '' : ' day-score--empty'}${landed ? ' day-score--landed' : ''}`}>
      <span className="day-score__label">Your points</span>
      <span className="day-score__value">{fmtPoints(shown)}</span>
      <span className="day-score__note">{note}</span>
    </div>
  )
}
