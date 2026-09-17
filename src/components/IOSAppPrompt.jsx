import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import Icon from './Icon'
import logoUrl from '/favicon.svg'
import './IOSAppPrompt.css'

const APP_STORE_URL = 'https://apps.apple.com/us/app/tempify-me/id6765572192?ppid=26675011-0f5b-40a0-be60-8efcc0f6c4a1'
const DISMISSED_KEY = 'tempify-ios-prompt-dismissed'

// Wait a beat so the card doesn't land on top of a page that is still settling.
const DELAY_MS = 2500

// iPhone and iPad web only. The App Store link is no use anywhere else, and
// inside the packaged app it would be pointing at itself.
function shouldOffer() {
  if (Capacitor.isNativePlatform()) return false
  if (typeof navigator === 'undefined') return false

  const ua = navigator.userAgent || ''
  const isIPhone = /iPhone|iPod/.test(ua)
  // iPads report as a Mac since iPadOS 13, so touch points are the giveaway.
  const isIPad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (!isIPhone && !isIPad) return false

  // Already saved to the home screen, so they've picked how they want to play.
  if (navigator.standalone || window.matchMedia('(display-mode: standalone)').matches) return false

  try {
    return localStorage.getItem(DISMISSED_KEY) !== '1'
  } catch {
    // Blocked storage means we can't remember a dismissal, so don't nag.
    return false
  }
}

export default function IOSAppPrompt() {
  const { pathname } = useLocation()
  const [show, setShow] = useState(false)

  // Games own the bottom of the screen with the guess field, so stay off them.
  const onGame = pathname.startsWith('/game/')

  useEffect(() => {
    if (onGame || !shouldOffer()) return
    const timer = setTimeout(() => setShow(true), DELAY_MS)
    return () => clearTimeout(timer)
  }, [onGame])

  if (!show || onGame) return null

  function dismiss() {
    setShow(false)
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // Nothing to do if storage is blocked; it comes back next visit.
    }
  }

  return (
    <div className="ios-prompt" role="dialog" aria-label="Tempify for iPhone">
      <div className="ios-prompt__card">
        <img src={logoUrl} alt="" aria-hidden="true" className="ios-prompt__logo" />

        <div className="ios-prompt__copy">
          <p className="ios-prompt__title">Tempify is on the App Store</p>
          <p className="ios-prompt__sub">Play the daily games in the iPhone app.</p>
        </div>

        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={dismiss}
          className="ios-prompt__btn btn-press"
        >
          Get it
        </a>

        <button type="button" onClick={dismiss} className="ios-prompt__close" aria-label="Close">
          <Icon name="x" size={16} />
        </button>
      </div>
    </div>
  )
}
