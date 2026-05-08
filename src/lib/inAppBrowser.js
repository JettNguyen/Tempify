import { Browser } from '@capacitor/browser'
import { isNativeApp } from './oauth'

export async function openExternalUrlInApp(url) {
  if (!url) return

  if (isNativeApp()) {
    // Custom URL schemes (itms-apps://, tel:, mailto:, etc.) cannot be opened
    // by SFSafariViewController — route them directly through WKWebView instead,
    // which hands them off to the system (App Store, Phone, Mail, etc.).
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      window.location.href = url
      return
    }
    await Browser.open({ url })
    return
  }

  window.location.href = url
}
