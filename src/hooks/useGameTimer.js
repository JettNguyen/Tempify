import { useState, useEffect, useRef } from 'react'

// Starts counting up from 0 when the component mounts.
// Call stop() when the game ends - returns elapsed seconds.
export function useGameTimer(active = true, delayMs = 0) {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(null)
  const rafRef = useRef(null)
  const timeoutRef = useRef(null)
  const stoppedRef = useRef(false)

  useEffect(() => {
    if (!active) return
    stoppedRef.current = false
    setElapsed(0)

    function start() {
      startRef.current = performance.now()

      function tick() {
        if (stoppedRef.current) return
        setElapsed(((performance.now() - startRef.current) / 1000))
        rafRef.current = requestAnimationFrame(tick)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    if (delayMs > 0) {
      timeoutRef.current = window.setTimeout(start, delayMs)
    } else {
      start()
    }

    return () => {
      cancelAnimationFrame(rafRef.current)
      clearTimeout(timeoutRef.current)
    }
  }, [active, delayMs])

  function stop() {
    if (stoppedRef.current) return elapsed
    stoppedRef.current = true
    cancelAnimationFrame(rafRef.current)
    const final = (performance.now() - startRef.current) / 1000
    setElapsed(final)
    return final
  }

  function fmt(s) {
    const mins = Math.floor(s / 60)
    const secs = Math.floor(s % 60)
    const tenths = Math.floor((s % 1) * 10)
    return mins > 0
      ? `${mins}:${String(secs).padStart(2, '0')}`
      : `${secs}.${tenths}s`
  }

  return { elapsed, stop, display: fmt(elapsed) }
}
