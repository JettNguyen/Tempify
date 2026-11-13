import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

// Marks the page as the iPhone app (body.ios-native-app), for the styles only
// the app needs: its own scroll area, room for the status bar, and no webview
// tells. The iPad app used to get a fixed zoom here too; it's fitted to the
// screen now, the way a big window is (useBigScreenScale).
export function useIOSAppClass() {
  useEffect(() => {
    const isNativeIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
    document.body.classList.toggle('ios-native-app', isNativeIOS)
    return () => document.body.classList.remove('ios-native-app')
  }, [])
}
