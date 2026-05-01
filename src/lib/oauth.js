import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { supabase } from './supabase'

const APP_SCHEME = import.meta.env.VITE_APP_URL_SCHEME || 'me.tempify'

export function isNativeApp() {
  return Capacitor.isNativePlatform()
}

export function getOAuthRedirectTo() {
  if (isNativeApp()) {
    return `${APP_SCHEME}://auth/callback`
  }
  return window.location.origin + import.meta.env.BASE_URL
}

export async function signInWithGoogleOAuth() {
  const native = isNativeApp()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getOAuthRedirectTo(),
      skipBrowserRedirect: native,
    },
  })

  if (error) throw error

  if (native && data?.url) {
    await Browser.open({ url: data.url })
  }
}
