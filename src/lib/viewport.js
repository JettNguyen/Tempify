import { Capacitor } from '@capacitor/core'

// The website lets people pinch to zoom: someone who needs bigger text can get
// it, and a page that blocks zoom fails WCAG 1.4.4. The iPhone app keeps the
// lock it has always had, so a double tap or a focused field never leaves a
// game zoomed in. Capacitor stops pinching in its web view too; the tag is
// what stops the rest.
const LOCK = 'maximum-scale=1.0, user-scalable=no'

/** A viewport tag's content with zoom locked. */
export function lockedViewport(content) {
  if (/user-scalable\s*=\s*no/.test(content)) return content
  return [content.trim(), LOCK].filter(Boolean).join(', ')
}

/**
 * Locks zoom, in the iPhone app only. Run before the app renders, so it never
 * shows a screen that can be zoomed.
 */
export function lockZoomInApp(doc = document) {
  if (!Capacitor.isNativePlatform()) return
  const tag = doc.querySelector('meta[name="viewport"]')
  if (tag) tag.setAttribute('content', lockedViewport(tag.getAttribute('content') || ''))
}
