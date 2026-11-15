import { useRef, useState } from 'react'
import { hapticSelection } from '../lib/haptics'

/** How far a swipe has to go, as a share of the stage's width, to count. */
export const PICK_AT = 0.28

/**
 * Which way a swipe picks when it's let go, or null to spring back. Far
 * enough counts, and so does a quick flick the same way it was going.
 *
 * @param dx        how far it went, in pixels, negative to the left
 * @param width     the width of what was swiped
 * @param velocity  how fast it was moving at the end, in pixels a millisecond
 */
export function swipePick(dx, width, velocity) {
  const far = Math.abs(dx) >= width * PICK_AT
  const flung = Math.abs(velocity) > 0.6 && Math.abs(dx) > 24 && Math.sign(velocity) === Math.sign(dx)
  if (!far && !flung) return null
  return dx < 0 ? 'left' : 'right'
}

// How far back a flick's speed is measured, and the least time that says
// anything: two touch reports a few milliseconds apart make any small step
// look fast.
const FLICK_WINDOW = 100
const FLICK_MIN_TIME = 20

/**
 * How fast a drag was going as it ended, in pixels a millisecond, from the
 * points it passed ({ x, t }, oldest first) over its last tenth of a second.
 * Zero when that's too short to tell, or the finger had stopped.
 */
export function flickVelocity(points) {
  if (points.length < 2) return 0
  const last = points[points.length - 1]
  const first = points.find((p) => last.t - p.t <= FLICK_WINDOW) ?? last
  const dt = last.t - first.t
  return dt >= FLICK_MIN_TIME ? (last.x - first.x) / dt : 0
}

/**
 * The stage as something to swipe toward an answer card: Cover or Not's song,
 * left toward one answer and right toward the other. The cards stay tappable;
 * this is the other way in.
 *
 * Put `handlers` on an element holding the stage. A press on the stage that
 * moves sideways is a swipe; one that moves up or down is left alone, and so
 * is anything starting on the scrubber, which has its own sideways drag.
 *
 * @returns dx (how far it's out, to move the stage by), progress (0 to 1, how
 *          close it is to counting), active, and handlers
 */
export function useSwipeChoice({ enabled, onPick }) {
  const [dx, setDx] = useState(0)
  const [active, setActive] = useState(false)
  const [width, setWidth] = useState(1)
  const gesture = useRef(null)

  function onPointerDown(e) {
    if (!enabled) return
    const stage = e.target.closest?.('.audio-stage')
    if (!stage || e.target.closest('.audio-timeline')) return
    gesture.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      points: [{ x: e.clientX, t: e.timeStamp }],
      width: stage.getBoundingClientRect().width || 1,
      stage,
      on: false,
      past: false,
    }
  }

  function onPointerMove(e) {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    const mx = e.clientX - g.x
    const my = e.clientY - g.y
    if (!g.on) {
      // Up or down first: a scroll or a tap, not a swipe.
      if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) {
        gesture.current = null
        return
      }
      if (Math.abs(mx) < 10) return
      g.on = true
      g.stage.setPointerCapture?.(e.pointerId)
      setWidth(g.width)
      setActive(true)
    }
    g.points.push({ x: e.clientX, t: e.timeStamp })
    g.points = g.points.filter((p) => e.timeStamp - p.t <= FLICK_WINDOW * 2)
    // A tick as it crosses the line where letting go counts.
    const past = Math.abs(mx) >= g.width * PICK_AT
    if (past !== g.past) {
      g.past = past
      if (past) hapticSelection('tick')
    }
    setDx(mx)
  }

  function end(e) {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    gesture.current = null
    if (!g.on) return
    g.points.push({ x: e.clientX, t: e.timeStamp })
    const side = e.type === 'pointerup' ? swipePick(e.clientX - g.x, g.width, flickVelocity(g.points)) : null
    setActive(false)
    setDx(0)
    if (side) onPick(side)
  }

  return {
    dx,
    active,
    progress: Math.min(1, Math.abs(dx) / (width * PICK_AT)),
    handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end },
  }
}
