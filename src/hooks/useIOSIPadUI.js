import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

const IPAD_MIN_SHORT_SIDE = 744

function shouldUseIPadUI() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return false

  const shortSide = Math.min(window.innerWidth, window.innerHeight)
  const hasCoarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches ?? true

  return hasCoarsePointer && shortSide >= IPAD_MIN_SHORT_SIDE
}

export function useIOSIPadUI() {
  useEffect(() => {
    const isNativeIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'

    function syncIPadClass() {
      document.body.classList.toggle('ios-native-app', isNativeIOS)
      document.body.classList.toggle('ios-ipad-ui', shouldUseIPadUI())
    }

    syncIPadClass()
    window.addEventListener('resize', syncIPadClass, { passive: true })
    window.addEventListener('orientationchange', syncIPadClass)

    return () => {
      window.removeEventListener('resize', syncIPadClass)
      window.removeEventListener('orientationchange', syncIPadClass)
      document.body.classList.remove('ios-native-app')
      document.body.classList.remove('ios-ipad-ui')
    }
  }, [])
}
