import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { playSound } from './sounds'

// Each kind of feedback here is felt and heard together: every one also plays
// its sound (sounds.js), which a caller can swap for another, or leave out with
// null when a sound of its own follows at once. The sounds play on the web too,
// where there is nothing to feel.

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
export function hapticImportantTap(sound = 'lockin') {
  const now = Date.now()
  if (now - lastTapAt < 180) return
  lastTapAt = now

  playSound(sound)
  impact(ImpactStyle.Light)
}

/** Light tick for changing a toggle, tab, filter, or picking from a list. */
export function hapticSelection(sound = 'tap') {
  playSound(sound)
  impact(ImpactStyle.Light)
}

/** Crossing a gesture threshold, like pull-to-refresh arming. */
export function hapticThreshold(sound = 'tick') {
  playSound(sound)
  impact(ImpactStyle.Medium)
}

/** A guess was wrong but the round continues. */
export function hapticWrong(sound = 'wrong') {
  playSound(sound)
  notify(NotificationType.Warning)
}

/** The round ended and it was not solved. */
export function hapticFailure(sound = 'lost') {
  playSound(sound)
  notify(NotificationType.Error)
}

/**
 * An action was refused: a repeat guess, a locked option. Felt only: the notice
 * says what happened, and the wrong-guess sound would say it had counted.
 */
export function hapticRejected() {
  impact(ImpactStyle.Heavy)
}

export function hapticWinCelebration(sound = 'win') {
  playSound(sound)
  if (!isNative) return

  Haptics.notification({ type: NotificationType.Success })
    .then(() => Haptics.impact({ style: ImpactStyle.Medium }))
    .catch(() => {})
}
