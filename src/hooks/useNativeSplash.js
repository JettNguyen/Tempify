import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'

// Hard ceiling. The splash is configured not to auto-hide, so nothing else
// would take it down if startup stalls.
const MAX_WAIT_MS = 2500

async function hideSplash(hiddenRef) {
  if (hiddenRef.current) return
  hiddenRef.current = true
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch {
    // Plugin unavailable or already hidden — nothing to recover from.
  }
}

/**
 * Holds the native launch screen until the app has something real to show,
 * so the logo hands off straight to content instead of flashing an empty shell.
 */
export function useNativeSplash(ready) {
  const hiddenRef = useRef(false)

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !ready) return

    let cancelled = false
    // Waiting on fonts too, otherwise the first frame after the splash is the
    // fallback typeface and swaps a moment later.
    const fonts = document.fonts?.ready ?? Promise.resolve()
    fonts
      .catch(() => {})
      .then(() => { if (!cancelled) hideSplash(hiddenRef) })

    return () => { cancelled = true }
  }, [ready])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const timer = setTimeout(() => hideSplash(hiddenRef), MAX_WAIT_MS)
    return () => clearTimeout(timer)
  }, [])
}
