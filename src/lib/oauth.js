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
      queryParams: {
        // Signing out of Tempify doesn't sign you out of Google, and the OAuth
        // browser still holds that session. Without this Google silently
        // re-authorises whichever account it saw last, so switching accounts is
        // impossible — the chooser flashes past and you land back where you were.
        prompt: 'select_account',
      },
    },
  })

  if (error) throw error

  if (native && data?.url) {
    await Browser.open({ url: data.url })
  }
}

export async function signInWithApple() {
  const native = isNativeApp()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
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
