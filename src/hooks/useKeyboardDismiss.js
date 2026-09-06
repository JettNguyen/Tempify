import { useEffect } from 'react'
import { dismissKeyboard } from '../lib/keyboard'

// Tapping any control leaves focus handling to that control — otherwise this
// would fight buttons that deliberately keep focus, like the search field's
// clear button.
const INTERACTIVE = 'input, textarea, select, button, a, label, [role="button"], [contenteditable="true"]'

// Inputs that don't raise a keyboard shouldn't trigger a dismiss.
const TEXT_TYPES = new Set(['text', 'search', 'email', 'password', 'tel', 'url', 'number', ''])

/**
 * Tapping the page background puts the keyboard away, the way a native app
 * behaves. Backs up the keyboard's own Done button rather than replacing it.
 */
export function useKeyboardDismiss() {
  useEffect(() => {
    function onPointerDown(e) {
      const active = document.activeElement
      if (!active) return

      const tag = active.tagName
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') return
      if (tag === 'INPUT' && !TEXT_TYPES.has(active.type)) return
      if (e.target?.closest?.(INTERACTIVE)) return

      dismissKeyboard()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [])
}
