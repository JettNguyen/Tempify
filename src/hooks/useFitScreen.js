import { useEffect, useLayoutEffect, useRef } from 'react'

export const TIGHT = 'page-shell--tight'

/**
 * The height a game has to fit in. It's measured again only when the width
 * changes (turned, or a new window). The height alone changes when the
 * keyboard comes up in the app or Safari's toolbars slide, and a game
 * shouldn't fold its stage away under a field being typed in.
 */
export function fitHeight(state, { width, height }) {
  if (state.width !== width) return { width, height }
  return state
}

/** Whether a page this tall runs off a screen this tall. */
export function overflows(pageHeight, screenHeight) {
  return pageHeight > screenHeight + 1
}

function screenSize() {
  const scroller = document.body.classList.contains('ios-native-app')
    ? document.querySelector('.app-scroll-container')
    : null
  if (scroller) return { width: window.innerWidth, height: scroller.clientHeight }
  // A tablet's page is zoomed (useBigScreenScale), and the game is measured
  // in the page's own units, so the window is too.
  const zoom = parseFloat(getComputedStyle(document.body).getPropertyValue('--big-screen-scale')) || 1
  return { width: window.innerWidth, height: window.innerHeight / zoom }
}

/**
 * Keeps a game on one screen as it grows. Era's line fills in, One Bar's
 * guesses stack up, a finished day lists every song. When the page would run
 * past the bottom of the screen, the shell gets `page-shell--tight`, which
 * folds the stage into a compact player and tightens the lists (the CSS is
 * with each of them, for phones and touch screens; a desktop window just
 * scrolls). When there's room again it comes off.
 *
 * It decides with the class off every time, and it runs after every render,
 * before the browser draws, so the page never shows the overflowing layout
 * for a frame. Between renders it only ever folds: a height read in the
 * frame the class comes off can be a few points short, and letting that
 * unfold the page would flip it back and forth for as long as it's open.
 * What makes room again (the next round, the screen turning) unfolds it.
 */
export function useFitScreen(ref) {
  const sizeRef = useRef(null)

  function fit(mayUnfold) {
    const shell = ref.current
    if (!shell) return
    const before = sizeRef.current
    sizeRef.current = fitHeight(before ?? {}, screenSize())
    const turned = sizeRef.current !== before
    const folded = shell.classList.contains(TIGHT)
    shell.classList.remove(TIGHT)
    if (overflows(shell.offsetHeight, sizeRef.current.height) || (folded && !mayUnfold && !turned)) {
      shell.classList.add(TIGHT)
    }
  }

  // Every render: a round revealed, a guess added, the day finished.
  useLayoutEffect(() => fit(true))

  // What changes without a render here: the screen turning, the clip player's
  // own state, a font or a cover arriving. These fold, and unfold only when
  // the screen turned.
  useEffect(() => {
    let frame = 0
    const later = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; fit(false) })
    }
    window.addEventListener('resize', later)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(later)
    if (ref.current) observer?.observe(ref.current)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', later)
      observer?.disconnect()
    }
  }, [])
}
