import { Capacitor } from '@capacitor/core'

const isNative = Capacitor.isNativePlatform()

async function plugin() {
  const { Keyboard } = await import('@capacitor/keyboard')
  return Keyboard
}

/**
 * Turns on the native accessory bar, which is what puts a "Done" button above
 * the keyboard. Capacitor hides it by default, so without this there is no way
 * to dismiss the keyboard in the app other than submitting the field.
 */
export async function initKeyboard() {
  if (!isNative) return
  try {
    const Keyboard = await plugin()
    // iPhone only; a no-op elsewhere.
    await Keyboard.setAccessoryBarVisible({ isVisible: true })
  } catch {
    // Plugin unavailable — the web fallback below still applies.
  }
}

/**
 * Drops focus and puts the keyboard away. Blurring alone is unreliable in a
 * webview, so ask the plugin as well when we're in the app.
 */
export function dismissKeyboard() {
  const active = document.activeElement
  if (active && typeof active.blur === 'function') active.blur()

  if (!isNative) return
  plugin()
    .then((Keyboard) => Keyboard.hide())
    .catch(() => {})
}
