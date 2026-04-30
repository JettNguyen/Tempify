import { useState, useEffect, useRef } from 'react'

function getStorageBackends() {
  if (typeof window === 'undefined') return []
  const backends = []
  try {
    if (window.localStorage) backends.push(window.localStorage)
  } catch {
    // Ignore blocked localStorage access.
  }
  try {
    if (window.sessionStorage) backends.push(window.sessionStorage)
  } catch {
    // Ignore blocked sessionStorage access.
  }
  return backends
}

function readPersistedEpoch(persistKey) {
  if (!persistKey) return null
  const backends = getStorageBackends()
  for (const storage of backends) {
    try {
      const raw = storage.getItem(persistKey)
      if (!raw) continue
      const parsed = Number(raw)
      if (Number.isFinite(parsed)) return parsed
    } catch {
      // Continue trying other backends.
    }
  }
  return null
}

function writePersistedEpoch(persistKey, epochMs) {
  if (!persistKey) return
  const backends = getStorageBackends()
  for (const storage of backends) {
    try {
      storage.setItem(persistKey, String(epochMs))
    } catch {
      // Continue trying other backends.
    }
  }
}

function clearPersistedEpoch(persistKey) {
  if (!persistKey) return
  const backends = getStorageBackends()
  for (const storage of backends) {
    try {
      storage.removeItem(persistKey)
    } catch {
      // Continue trying other backends.
    }
  }
}

// Starts counting up from 0 when the component mounts.
// Call stop() when the game ends - returns elapsed seconds.
export function useGameTimer(active = true, delayMs = 0, persistKey = null) {
  const [elapsed, setElapsed] = useState(0)
  const startEpochRef = useRef(null)
  const rafRef = useRef(null)
  const timeoutRef = useRef(null)
  const stoppedRef = useRef(false)

  useEffect(() => {
    if (!active) return
    stoppedRef.current = false

    const persistedEpoch = readPersistedEpoch(persistKey)
    const startEpoch = persistedEpoch ?? (Date.now() + delayMs)
    if (persistedEpoch == null) writePersistedEpoch(persistKey, startEpoch)
    startEpochRef.current = startEpoch
    setElapsed(Math.max(0, (Date.now() - startEpoch) / 1000))

    function start() {
      function tick() {
        if (stoppedRef.current) return
        setElapsed(Math.max(0, (Date.now() - startEpochRef.current) / 1000))
        rafRef.current = requestAnimationFrame(tick)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    const remainingDelay = startEpoch - Date.now()
    if (remainingDelay > 0) {
      timeoutRef.current = window.setTimeout(start, remainingDelay)
    } else {
      start()
    }

    return () => {
      cancelAnimationFrame(rafRef.current)
      clearTimeout(timeoutRef.current)
    }
  }, [active, delayMs, persistKey])

  function stop() {
    if (stoppedRef.current) return elapsed
    stoppedRef.current = true
    cancelAnimationFrame(rafRef.current)
    clearTimeout(timeoutRef.current)
    const startEpoch = startEpochRef.current
    if (startEpoch == null) return elapsed
    const final = Math.max(0, (Date.now() - startEpoch) / 1000)
    setElapsed(final)
    clearPersistedEpoch(persistKey)
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
