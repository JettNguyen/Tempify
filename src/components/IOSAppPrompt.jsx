import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import Icon from './Icon'
import logoUrl from '/favicon.svg'
import './IOSAppPrompt.css'

const APP_STORE_URL = 'https://apps.apple.com/us/app/tempify-me/id6765572192?ppid=26675011-0f5b-40a0-be60-8efcc0f6c4a1'
// The newest APK on the repo's releases. GitHub keeps this link pointing at
// the latest one, so a new release needs no change here.
const ANDROID_APK_URL = 'https://github.com/JettNguyen/Tempify/releases/latest/download/Tempify.apk'
const DISMISSED_KEY = 'tempify-ios-prompt-dismissed'

// Wait a beat so the card doesn't land on top of a page that is still settling.
const DELAY_MS = 2500

// The Android app is a file from the repo's releases, not a Play Store
// listing, so its card says how to install one.
const COPY = {
  ios: {
    title: 'Tempify is on the App Store',
    sub: 'Play the daily games in the iPhone app.',
    action: 'Get it',
    href: APP_STORE_URL,
  },
  android: {
    title: 'Tempify is on Android',
    sub: 'It downloads as a file, not from the Play Store. Open it, and allow the install if your phone asks.',
    action: 'Download',
    href: ANDROID_APK_URL,
  },
}

// iPhone, iPad and Android web only, as 'ios' or 'android'. The app links are
// no use anywhere else, and inside the packaged apps they would point at
// themselves.
function offerFor() {
  if (Capacitor.isNativePlatform()) return null
  if (typeof navigator === 'undefined') return null

  const ua = navigator.userAgent || ''
  const isIPhone = /iPhone|iPod/.test(ua)
  // iPads report as a Mac since iPadOS 13, so touch points are the giveaway.
  const isIPad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const platform = isIPhone || isIPad ? 'ios' : /Android/.test(ua) ? 'android' : null
  if (!platform) return null

  // Already saved to the home screen, so they've picked how they want to play.
  if (navigator.standalone || window.matchMedia('(display-mode: standalone)').matches) return null

  try {
    return localStorage.getItem(DISMISSED_KEY) !== '1' ? platform : null
  } catch {
    // Blocked storage means we can't remember a dismissal, so don't nag.
    return null
  }
}

export default function IOSAppPrompt() {
  const { pathname } = useLocation()
  const [platform, setPlatform] = useState(null)
  const show = platform !== null

  // Games own the bottom of the screen with the guess field, so stay off them.
  const onGame = pathname.startsWith('/game/')

  useEffect(() => {
    const offer = onGame ? null : offerFor()
    if (!offer) return
    const timer = setTimeout(() => setPlatform(offer), DELAY_MS)
    return () => clearTimeout(timer)
  }, [onGame])

  if (!show || onGame) return null
  const copy = COPY[platform]

  function dismiss() {
    setPlatform(null)
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // Nothing to do if storage is blocked; it comes back next visit.
    }
  }

  return (
    <div className="ios-prompt" role="dialog" aria-label={copy.title}>
      <div className="ios-prompt__card">
        <img src={logoUrl} alt="" aria-hidden="true" className="ios-prompt__logo" />

        <div className="ios-prompt__copy">
          <p className="ios-prompt__title">{copy.title}</p>
          <p className="ios-prompt__sub">{copy.sub}</p>
        </div>

        <a
          href={copy.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={dismiss}
          className="ios-prompt__btn btn-press"
        >
          {copy.action}
        </a>

        <button type="button" onClick={dismiss} className="ios-prompt__close" aria-label="Close">
          <Icon name="x" size={16} />
        </button>
      </div>
    </div>
  )
}
