import { Browser } from '@capacitor/browser'
import { isNativeApp } from './oauth'

export async function openExternalUrlInApp(url) {
  if (!url) return

  if (isNativeApp()) {
    await Browser.open({ url })
    return
  }

  window.location.href = url
}
