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

function readPersistedState(persistKey) {
  if (!persistKey) return null
  const backends = getStorageBackends()
  for (const storage of backends) {
    try {
      const raw = storage.getItem(persistKey)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') continue
      const elapsedMs = Number(parsed.elapsedMs)
      const delayRemainingMs = Number(parsed.delayRemainingMs)
      const startedAtMs = parsed.startedAtMs == null ? null : Number(parsed.startedAtMs)
      if (!Number.isFinite(elapsedMs) || !Number.isFinite(delayRemainingMs)) continue
      if (startedAtMs != null && !Number.isFinite(startedAtMs)) continue
      return {
        elapsedMs: Math.max(0, elapsedMs),
        delayRemainingMs: Math.max(0, delayRemainingMs),
        startedAtMs,
      }
    } catch {
      // Continue trying other backends.
    }
  }
  return null
}

function writePersistedState(persistKey, state) {
  if (!persistKey) return
  const backends = getStorageBackends()
  for (const storage of backends) {
    try {
      storage.setItem(persistKey, JSON.stringify(state))
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
  const elapsedMsRef = useRef(0)
  const startedAtMsRef = useRef(null)
  const delayRemainingMsRef = useRef(delayMs)
  const delayTargetMsRef = useRef(null)
  const rafRef = useRef(null)
  const timeoutRef = useRef(null)
  const stoppedRef = useRef(false)

  useEffect(() => {
    if (!active) return
    stoppedRef.current = false

    const persistedState = readPersistedState(persistKey)
    if (persistedState) {
      elapsedMsRef.current = persistedState.elapsedMs
      startedAtMsRef.current = null
      delayRemainingMsRef.current = persistedState.delayRemainingMs
    } else {
      elapsedMsRef.current = 0
      startedAtMsRef.current = null
      delayRemainingMsRef.current = delayMs
      writePersistedState(persistKey, {
        elapsedMs: 0,
        delayRemainingMs: delayMs,
        startedAtMs: null,
      })
    }
    setElapsed(elapsedMsRef.current / 1000)

    function start() {
      startedAtMsRef.current = Date.now()
      delayRemainingMsRef.current = 0
      writePersistedState(persistKey, {
        elapsedMs: elapsedMsRef.current,
        delayRemainingMs: 0,
        startedAtMs: startedAtMsRef.current,
      })

      function tick() {
        if (stoppedRef.current) return
        const base = elapsedMsRef.current
        const startedAt = startedAtMsRef.current
        if (startedAt == null) return
        setElapsed((base + (Date.now() - startedAt)) / 1000)
        rafRef.current = requestAnimationFrame(tick)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    if (delayRemainingMsRef.current > 0) {
      delayTargetMsRef.current = Date.now() + delayRemainingMsRef.current
      timeoutRef.current = window.setTimeout(start, delayRemainingMsRef.current)
    } else {
      start()
    }

    return () => {
      if (!stoppedRef.current) {
        if (startedAtMsRef.current != null) {
          elapsedMsRef.current += Date.now() - startedAtMsRef.current
          startedAtMsRef.current = null
          delayRemainingMsRef.current = 0
        } else if (delayTargetMsRef.current != null) {
          delayRemainingMsRef.current = Math.max(0, delayTargetMsRef.current - Date.now())
        }
        writePersistedState(persistKey, {
          elapsedMs: elapsedMsRef.current,
          delayRemainingMs: delayRemainingMsRef.current,
          startedAtMs: null,
        })
      }
      cancelAnimationFrame(rafRef.current)
      clearTimeout(timeoutRef.current)
      delayTargetMsRef.current = null
    }
  }, [active, delayMs, persistKey])

  function stop() {
    if (stoppedRef.current) return elapsed
    stoppedRef.current = true
    cancelAnimationFrame(rafRef.current)
    clearTimeout(timeoutRef.current)
    if (startedAtMsRef.current != null) {
      elapsedMsRef.current += Date.now() - startedAtMsRef.current
      startedAtMsRef.current = null
    }
    const final = elapsedMsRef.current / 1000
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
