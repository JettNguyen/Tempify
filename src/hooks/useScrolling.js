import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'

/**
 * Hook to track when the user is actively scrolling
 * Prevents button :active states from showing during scroll on touch devices
 */
export function useScrolling() {
  const scrollTimeoutRef = useRef(null)
  const isNative = Capacitor.isNativePlatform()

  useEffect(() => {
    // Only apply on native platforms (iOS/Android)
    if (!isNative) return

    function handleScroll() {
      // Add scrolling class immediately
      if (!document.body.classList.contains('is-scrolling')) {
        document.body.classList.add('is-scrolling')
      }

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }

      // Remove scrolling class after scroll ends (150ms debounce)
      scrollTimeoutRef.current = setTimeout(() => {
        document.body.classList.remove('is-scrolling')
      }, 150)
    }

    // Attach scroll listener to all scrollable containers
    const scrollableContainers = [
      window,
      document,
      document.documentElement,
      document.body,
    ]

    scrollableContainers.forEach(target => {
      target.addEventListener('scroll', handleScroll, { passive: true })
    })

    return () => {
      scrollableContainers.forEach(target => {
        target.removeEventListener('scroll', handleScroll)
      })
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [isNative])
}
