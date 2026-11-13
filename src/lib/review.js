import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { InAppReview } from '@capacitor-community/in-app-review'
import { todayEST } from './date'
import { firstPlayDay } from './plays'

// Apple's own rating prompt, in the iPhone app only. It comes right after a won
// day, never on the first day someone plays, and at most once for each version
// of the app. Apple has the last word on whether it shows (no more than three
// times a year), and a rating left there goes straight to the App Store.

const ASKED_KEY = 'tempify_rating_asked'

/**
 * Whether a finished day is the moment to ask for a rating. A day is won by
 * the game's own rule, the same one streaks use: half the points on offer
 * (isWin in ./points), or the right answer in One Bar and Cover or Not.
 * `custom` is a game a friend made, which isn't a day. `firstDay` is the first
 * day this device finished a game, and `askedVersion` the app version the last
 * ask came in.
 */
export function shouldAskForRating({ platform, won, custom, version, askedVersion, firstDay, today }) {
  if (platform !== 'ios') return false
  if (!won || custom) return false
  if (!version || version === askedVersion) return false
  return Boolean(firstDay && today && firstDay < today)
}

function askedVersion() {
  try {
    return localStorage.getItem(ASKED_KEY)
  } catch {
    return null
  }
}

/** Notes the version asked in, and says whether it stuck. */
function rememberAsked(version) {
  try {
    localStorage.setItem(ASKED_KEY, version)
    return localStorage.getItem(ASKED_KEY) === version
  } catch {
    return false
  }
}

/**
 * Asks for a rating if this finished day is the moment. Resolves to whether it
 * asked, and never throws.
 */
export async function askForRating({ won, custom = false }) {
  const platform = Capacitor.getPlatform()
  // The web has no App Store prompt, and no app version to read.
  if (platform !== 'ios') return false
  try {
    const { version } = await App.getInfo()
    const ask = shouldAskForRating({
      platform,
      won,
      custom,
      version,
      askedVersion: askedVersion(),
      firstDay: firstPlayDay(),
      today: todayEST(),
    })
    // Noted before asking: a phone that can't keep the note would otherwise be
    // asked after every win.
    if (!ask || !rememberAsked(version)) return false
    await InAppReview.requestReview()
    return true
  } catch {
    // A rating prompt is never worth an error on screen.
    return false
  }
}
