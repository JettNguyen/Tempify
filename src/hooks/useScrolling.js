import { useEffect, useRef } from 'react'

/**
 * A touch device fires :active the moment a finger lands, so tiles and buttons
 * flash pressed even when the gesture turns out to be a scroll. This flags an
 * in-flight scroll on the body so CSS can suppress the press state.
 */
export function useScrolling() {
  const timeoutRef = useRef(null)

  useEffect(() => {
    // Only an issue where a press and a scroll start with the same gesture.
    if (!window.matchMedia?.('(pointer: coarse)')?.matches) return

    function handleScroll() {
      document.body.classList.add('is-scrolling')
      clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        document.body.classList.remove('is-scrolling')
      }, 150)
    }

    // Scroll events don't bubble, so capture to catch them from whichever
    // container is actually scrolling — the window on web, .app-scroll-container
    // in the native shell.
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true })

    return () => {
      document.removeEventListener('scroll', handleScroll, { capture: true })
      clearTimeout(timeoutRef.current)
      document.body.classList.remove('is-scrolling')
    }
  }, [])
}
