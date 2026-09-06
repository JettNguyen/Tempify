import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

const isNative = Capacitor.isNativePlatform()
let lastTapAt = 0

function impact(style) {
  if (!isNative) return
  Haptics.impact({ style }).catch(() => {})
}

function notify(type) {
  if (!isNative) return
  Haptics.notification({ type }).catch(() => {})
}

/** Committing an answer. Throttled so a fast tapper doesn't get a buzz storm. */
export function hapticImportantTap() {
  if (!isNative) return

  const now = Date.now()
  if (now - lastTapAt < 180) return
  lastTapAt = now

  impact(ImpactStyle.Light)
}

/** Light tick for changing a toggle, tab, filter, or picking from a list. */
export function hapticSelection() {
  impact(ImpactStyle.Light)
}

/** Crossing a gesture threshold, like pull-to-refresh arming. */
export function hapticThreshold() {
  impact(ImpactStyle.Medium)
}

/** A guess was wrong but the round continues. */
export function hapticWrong() {
  notify(NotificationType.Warning)
}

/** The round ended and it was not solved. */
export function hapticFailure() {
  notify(NotificationType.Error)
}

/** An action was refused — a repeat guess, a locked option. */
export function hapticRejected() {
  impact(ImpactStyle.Heavy)
}

export function hapticWinCelebration() {
  if (!isNative) return

  Haptics.notification({ type: NotificationType.Success })
    .then(() => Haptics.impact({ style: ImpactStyle.Medium }))
    .catch(() => {})
}
