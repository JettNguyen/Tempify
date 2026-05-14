import { useEffect, useRef, useState, useCallback } from 'react'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

const THRESHOLD = 72
const MAX_PULL = 100
const LOADING_OFFSET = 52  // page rests here while spinner shows (below navbar)
const MIN_REFRESH_MS = 500

export function usePullToRefresh(onRefresh, containerRef) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // Use a ref bundle to avoid stale closures in touch handlers
  const state = useRef({
    startY: 0,
    startX: 0,
    pulling: false,
    direction: null, // 'vertical' | 'horizontal' | null
    pastThreshold: false,
    isRefreshing: false,
    pullDistance: 0,
  })

  const triggerRefresh = useCallback(async () => {
    state.current.isRefreshing = true
    setIsDragging(false)
    setIsRefreshing(true)
    // Snap to loading offset so the spinner stays visible below the navbar
    setPullDistance(LOADING_OFFSET)
    state.current.pullDistance = LOADING_OFFSET
    try {
      await Promise.all([onRefresh(), new Promise(res => setTimeout(res, MIN_REFRESH_MS))])
    } finally {
      state.current.isRefreshing = false
      setIsRefreshing(false)
      setPullDistance(0)
      state.current.pullDistance = 0
    }
  }, [onRefresh])

  useEffect(() => {
    const el = containerRef?.current ?? document

    function getScrollTop() {
      if (containerRef?.current) return containerRef.current.scrollTop
      // On iOS native the scroll lives in .app-scroll-container, not window
      const appScroll = document.querySelector('.app-scroll-container')
      if (appScroll) return appScroll.scrollTop
      return window.scrollY || document.documentElement.scrollTop
    }

    function onTouchStart(e) {
      if (state.current.isRefreshing) return
      const touch = e.touches[0]
      state.current.startY = touch.clientY
      state.current.startX = touch.clientX
      state.current.pulling = false
      state.current.direction = null
      state.current.pastThreshold = false
    }

    function onTouchMove(e) {
      if (state.current.isRefreshing) return

      const touch = e.touches[0]
      const dy = touch.clientY - state.current.startY
      const dx = touch.clientX - state.current.startX

      // Determine direction on first significant movement
      if (!state.current.direction) {
        if (Math.abs(dy) < 4 && Math.abs(dx) < 4) return
        state.current.direction = Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'horizontal'
      }

      // Don't interfere with horizontal scrolling
      if (state.current.direction === 'horizontal') return

      // Only activate if pulling down from the top
      if (dy <= 0 || getScrollTop() > 0) {
        if (state.current.pulling) {
          state.current.pulling = false
          state.current.pullDistance = 0
          setPullDistance(0)
          setIsDragging(false)
        }
        return
      }

      e.preventDefault()
      state.current.pulling = true
      setIsDragging(true)

      const eased = Math.min(dy * 0.55, MAX_PULL)
      state.current.pullDistance = eased
      setPullDistance(eased)

      // Fire haptic exactly once when crossing threshold
      if (eased >= THRESHOLD && !state.current.pastThreshold) {
        state.current.pastThreshold = true
        Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {})
      } else if (eased < THRESHOLD && state.current.pastThreshold) {
        state.current.pastThreshold = false
      }
    }

    function onTouchEnd() {
      if (!state.current.pulling) return
      state.current.pulling = false
      setIsDragging(false)

      if (state.current.pastThreshold) {
        state.current.pastThreshold = false
        triggerRefresh()
      } else {
        state.current.pullDistance = 0
        setPullDistance(0)
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [containerRef, triggerRefresh])

  return { pullDistance, isRefreshing, isDragging }
}
