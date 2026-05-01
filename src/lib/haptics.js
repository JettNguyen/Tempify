import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

const isNative = Capacitor.isNativePlatform()
let lastTapAt = 0

export function hapticImportantTap() {
  if (!isNative) return

  const now = Date.now()
  if (now - lastTapAt < 180) return
  lastTapAt = now

  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
}

export function hapticWinCelebration() {
  if (!isNative) return

  Haptics.notification({ type: NotificationType.Success })
    .then(() => Haptics.impact({ style: ImpactStyle.Medium }))
    .catch(() => {})
}
