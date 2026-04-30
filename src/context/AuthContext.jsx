import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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

    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL?.trim()
    if (data && adminEmail && data.email?.trim() === adminEmail) {
      data.is_subscribed = true
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
