import { useLayoutEffect } from 'react'
import { Capacitor } from '@capacitor/core'

// On a big desktop window the games sat in a narrow column of small type: at
// 1080p, a third of the width and half the height, too small to read on a
// stream. An iPad, in the app or in Safari, left the same narrow column with
// the rest of the screen empty. This zooms the whole app until the tallest game
// screen fills the window's height without scrolling: Hit or Miss, about 775px
// from the top of the navbar to its Lock in button, and the page's padding below
// that.
const HEIGHT_AT_1X = 775
// Keeps the zoomed page at least this wide, so it always lays out as a desktop
// page; the media queries still see the real window.
const WIDTH_AT_1X = 960
// A tablet is fitted the same way, with room for the iPad app's status bar
// above the navbar, and only as wide as a game needs: its 560px column and a
// margin either side. A tablet standing up is narrower than it is tall, and the
// desktop's width would leave it unzoomed.
const TABLET_HEIGHT_AT_1X = 825
const TABLET_WIDTH_AT_1X = 600
// The short side of the smallest iPad, the mini. The biggest phones are about
// 440, so no phone gets here in either orientation.
const TABLET_MIN_SIDE = 744
const MAX_SCALE = 1.5

function fit(width, height, widthAt1x, heightAt1x) {
  const scale = Math.min(width / widthAt1x, height / heightAt1x)
  // In steps of 0.05, so dragging a window's edge doesn't redraw the page
  // at every pixel. Rounded down, so the game still fits.
  return Math.min(MAX_SCALE, Math.max(1, Math.floor(scale * 20) / 20))
}

/** Whether a screen is a tablet: touch first, in the app or a browser, and big enough. */
export function isTablet({ native, mouse, width, height }) {
  return (native || !mouse) && Math.min(width, height) >= TABLET_MIN_SIDE
}

export function bigScreenScale({ native, mouse, width, height }) {
  if (isTablet({ native, mouse, width, height })) return fit(width, height, TABLET_WIDTH_AT_1X, TABLET_HEIGHT_AT_1X)
  // A phone, in the app or a browser, keeps the layout made for it.
  if (native || !mouse) return 1
  return fit(width, height, WIDTH_AT_1X, HEIGHT_AT_1X)
}

/**
 * Whether a resize should fit the page again. On a desktop any resize does. In
 * the app or on a touch screen only a new width does: turning it, or a new
 * window size. The on-screen keyboard and Safari's toolbars change only the
 * height, and fitting again then would zoom the page out from under the field
 * being typed in.
 */
export function refits({ native, mouse, width, fittedWidth }) {
  return (mouse && !native) || width !== fittedWidth
}

export function useBigScreenScale() {
  // Before the first paint, so a tablet never shows the unzoomed page first.
  useLayoutEffect(() => {
    const native = Capacitor.isNativePlatform()
    // A mouse, so not a phone or a tablet, which are laid out for touch.
    const mouse = window.matchMedia?.('(hover: hover) and (pointer: fine)')
    let fittedWidth = null

    function sync() {
      const hasMouse = mouse?.matches ?? false
      const width = window.innerWidth
      if (!refits({ native, mouse: hasMouse, width, fittedWidth })) return
      fittedWidth = width
      const scale = bigScreenScale({ native, mouse: hasMouse, width, height: window.innerHeight })
      document.body.classList.toggle('big-screen', scale > 1)
      document.body.style.setProperty('--big-screen-scale', String(scale))
    }

    // A trackpad coming or going changes which fit applies, at any width.
    function pointerChanged() {
      fittedWidth = null
      sync()
    }

    sync()
    window.addEventListener('resize', sync, { passive: true })
    mouse?.addEventListener?.('change', pointerChanged)

    return () => {
      window.removeEventListener('resize', sync)
      mouse?.removeEventListener?.('change', pointerChanged)
      document.body.classList.remove('big-screen')
      document.body.style.removeProperty('--big-screen-scale')
    }
  }, [])
}
