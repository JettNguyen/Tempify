import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { App as CapApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { supabase } from '../lib/supabase'
import { isNativeApp } from '../lib/oauth'
import { initRevenueCat, checkPremiumEntitlement } from '../lib/billing'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Ref keeps the current user ID accessible inside long-lived Capacitor listeners
  // without stale closure issues.
  const userIdRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        // Clear stale local auth state (e.g. invalid refresh token) and continue signed-out.
        await supabase.auth.signOut({ scope: 'local' })
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Keep the ref in sync so Capacitor listeners always see the current user ID.
  useEffect(() => {
    userIdRef.current = user?.id ?? null
  }, [user])

  // Re-check RC subscription status whenever the app comes back to the foreground.
  // This catches: returning from the subscription management page, sandbox renewals/
  // expirations that happened while the app was backgrounded, etc.
  useEffect(() => {
    if (!isNativeApp()) return

    let listenerHandle = null

    CapApp.addListener('appStateChange', async ({ isActive }) => {
      if (isActive && userIdRef.current) {
        await fetchProfile(userIdRef.current)
      }
    }).then(handle => { listenerHandle = handle })

    return () => { listenerHandle?.remove() }
  }, [])

  useEffect(() => {
    if (!isNativeApp()) return

    let isDisposed = false
    let listenerHandle = null
    const processedUrls = new Set()

    async function handleOAuthCallbackUrl(url) {
      if (!url || !url.includes('://auth/callback')) return
      if (processedUrls.has(url)) return
      processedUrls.add(url)

      try {
        const callbackUrl = new URL(url)
        const code = callbackUrl.searchParams.get('code')

        if (code) {
          await supabase.auth.exchangeCodeForSession(code)
        } else {
          const hashParams = new URLSearchParams(callbackUrl.hash.replace(/^#/, ''))
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')

          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
          }
        }
      } catch (err) {
        console.error('[Tempify] Failed to process OAuth callback:', err)
      }

      // Delay browser close so iOS system dialogs (e.g. password save prompt) have
      // time to appear and be dismissed before the browser is force-closed.
      await new Promise(resolve => setTimeout(resolve, 1000))
      try {
        await Browser.close()
      } catch {
        // Ignore close errors when browser is already closed.
      }
    }

    async function setupAppUrlListener() {
      listenerHandle = await CapApp.addListener('appUrlOpen', async ({ url }) => {
        await handleOAuthCallbackUrl(url)
      })

      const launchUrl = await CapApp.getLaunchUrl()
      await handleOAuthCallbackUrl(launchUrl?.url)

      if (isDisposed) {
        listenerHandle?.remove()
      }
    }

    setupAppUrlListener()

    return () => {
      isDisposed = true
      listenerHandle?.remove()
    }
  }, [])

  async function fetchProfile(userId) {
    let { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    // No row yet - happens when the DB trigger didn't fire (e.g. some OAuth flows).
    // Create the row client-side so the user can immediately set their avatar/username.
    if (!data) {
      const { data: authData } = await supabase.auth.getUser()
      const email = authData?.user?.email ?? null
      const { data: created } = await supabase
        .from('users')
        .insert({ id: userId, email })
        .select()
        .maybeSingle()
      data = created
    }

    const premiumEmails = (import.meta.env.VITE_PREMIUM_EMAILS || '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean)
    const emailBasedPremium = Boolean(
      data && premiumEmails.length && premiumEmails.includes((data.email || '').trim().toLowerCase())
    )

    let nativePremium = false
    if (isNativeApp()) {
      try {
        await initRevenueCat(userId)
        nativePremium = await checkPremiumEntitlement()
      } catch {
        nativePremium = false
      }

      // Sync RC status into rc_subscribed and recompute is_subscribed.
      // This is a safety net for when webhooks are delayed or missed.
      // stripe_subscribed is preserved so a cancelled iOS sub never revokes
      // an active Stripe subscription on the web side.
      if (data && data.rc_subscribed !== nativePremium) {
        const newIsSubscribed = Boolean(nativePremium || data.stripe_subscribed || emailBasedPremium)
        await supabase
          .from('users')
          .update({ rc_subscribed: nativePremium, is_subscribed: newIsSubscribed })
          .eq('id', userId)
        data.rc_subscribed = nativePremium
        data.is_subscribed = newIsSubscribed
      }
    }

    if (data) {
      // iOS: combine live RC check with stripe_subscribed from DB so a web
      // subscription also unlocks premium in the iOS app.
      // Web: DB is authoritative (managed by Stripe webhook).
      if (isNativeApp()) {
        data.is_subscribed = Boolean(emailBasedPremium || nativePremium || data.stripe_subscribed)
      } else {
        data.is_subscribed = Boolean(data.is_subscribed || emailBasedPremium)
      }
    }
    setProfile(data)
    setLoading(false)
  }

  // Called after profile mutations so all consumers (Navbar, etc.) update instantly
  async function refreshProfile() {
    if (user) await fetchProfile(user.id)
  }

  // Called immediately after a confirmed purchase (Apple IAP or Stripe).
  // Writes is_subscribed=true to the DB and updates local state right away,
  // so premium features unlock without waiting for a webhook or RC round-trip.
  async function markSubscribed() {
    if (!user) return
    await supabase
      .from('users')
      .update({ is_subscribed: true, rc_subscribed: true })
      .eq('id', user.id)
    setProfile(p => p ? { ...p, is_subscribed: true, rc_subscribed: true } : p)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function deleteAccount() {
    const { error } = await supabase.rpc('delete_user')
    if (error) throw new Error(error.message || 'Account deletion failed. Please try again.')
    await supabase.auth.signOut({ scope: 'local' })
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, deleteAccount, refreshProfile, markSubscribed }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
