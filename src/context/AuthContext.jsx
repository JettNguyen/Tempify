import { createContext, useContext, useState, useEffect } from 'react'
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
    }

    if (data) {
      data.is_subscribed = Boolean(data.is_subscribed || emailBasedPremium || nativePremium)
    }
    setProfile(data)
    setLoading(false)
  }

  // Called after profile mutations so all consumers (Navbar, etc.) update instantly
  async function refreshProfile() {
    if (user) await fetchProfile(user.id)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
