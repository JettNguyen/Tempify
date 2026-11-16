import { useEffect } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { useAuth } from './useAuth'
import { stepsBack } from '../lib/backStack'

// Gives up on a trip back that never lands (it always does; this only keeps a
// stray listener from waiting forever).
const LAND_TIMEOUT_MS = 1000

/**
 * Keeps the iPhone app's swipe-back history short (lib/backStack has the
 * rules). Only the app turns it on: in a browser the back button is the
 * browser's, and it should go where the browser says.
 *
 * Going back fires popstate, which the router hears first and starts to show
 * the page landed on. Putting the opened page back in place in the same event
 * lets React draw both changes as one, so the page landed on never shows.
 */
export function useShallowHistory(enabled) {
  const location = useLocation()
  const type = useNavigationType()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const ownProfile = profile?.username ? `/u/${profile.username}` : null

  useEffect(() => {
    // A swipe back is the history doing its job. The page put back in place
    // below is a replace at the first entry, which stepsBack leaves alone.
    if (!enabled || type === 'POP') return
    const steps = stepsBack(location.pathname, window.history.state?.idx, ownProfile, type === 'REPLACE')
    if (!steps) return

    const { pathname, search, hash, state } = location
    let timer = 0
    function land() {
      window.removeEventListener('popstate', land)
      clearTimeout(timer)
      navigate({ pathname, search, hash }, { replace: true, state })
    }
    window.addEventListener('popstate', land)
    timer = setTimeout(() => window.removeEventListener('popstate', land), LAND_TIMEOUT_MS)
    window.history.go(-steps)
    // Once per page opened: a new key is a new page.
  }, [location.key])
}
