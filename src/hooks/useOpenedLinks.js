import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'
import { appPathFor } from '../lib/appLinks'

// The same link can arrive twice on a cold start: once as the launch address
// and once as the event the app plugin held for its first listener.
const SAME_LINK_MS = 2000
let last = { url: null, at: 0 }

/**
 * Opens the page a tapped tempify.me link points at, in the iPhone app. A
 * link that launches the app is read once at startup; one tapped while it's
 * running arrives as an event. Sign-in callbacks are AuthContext's.
 */
export function useOpenedLinks(enabled) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!enabled) return
    let disposed = false
    let handle = null

    function open(url) {
      const path = appPathFor(url)
      if (!path || disposed) return
      const now = Date.now()
      if (url === last.url && now - last.at < SAME_LINK_MS) return
      last = { url, at: now }
      navigate(path)
    }

    CapApp.addListener('appUrlOpen', ({ url }) => open(url))
      .then((h) => { if (disposed) h.remove(); else handle = h })
      .catch(() => {})
    CapApp.getLaunchUrl()
      .then((launch) => open(launch?.url))
      .catch(() => {})

    return () => {
      disposed = true
      handle?.remove()
    }
  }, [enabled])
}
