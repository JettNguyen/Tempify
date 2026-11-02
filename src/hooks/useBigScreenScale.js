import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

// On a big desktop window the games sat in a narrow column of small type: at
// 1080p, a third of the width and half the height, too small to read on a
// stream. This zooms the whole app, the way the iPad app does (useIOSIPadUI),
// until the tallest game screen fills the window's height without scrolling:
// Hit or Miss, about 720px from the top of the navbar to its Lock in button,
// and the page's padding below that.
const HEIGHT_AT_1X = 775
// Keeps the zoomed page at least this wide, so it always lays out as a desktop
// page; the media queries still see the real window.
const WIDTH_AT_1X = 960
const MAX_SCALE = 1.5

export function bigScreenScale({ native, mouse, width, height }) {
  if (native || !mouse) return 1
  const fit = Math.min(width / WIDTH_AT_1X, height / HEIGHT_AT_1X)
  // In steps of 0.05, so dragging a window's edge doesn't redraw the page
  // at every pixel. Rounded down, so the game still fits.
  return Math.min(MAX_SCALE, Math.max(1, Math.floor(fit * 20) / 20))
}

export function useBigScreenScale() {
  useEffect(() => {
    const native = Capacitor.isNativePlatform()
    // A mouse, so not a phone or a tablet, which are laid out for touch.
    const mouse = window.matchMedia?.('(hover: hover) and (pointer: fine)')

    function sync() {
      const scale = bigScreenScale({
        native,
        mouse: mouse?.matches ?? false,
        width: window.innerWidth,
        height: window.innerHeight,
      })
      document.body.classList.toggle('big-screen', scale > 1)
      document.body.style.setProperty('--big-screen-scale', String(scale))
    }

    sync()
    window.addEventListener('resize', sync, { passive: true })
    mouse?.addEventListener?.('change', sync)

    return () => {
      window.removeEventListener('resize', sync)
      mouse?.removeEventListener?.('change', sync)
      document.body.classList.remove('big-screen')
      document.body.style.removeProperty('--big-screen-scale')
    }
  }, [])
}
