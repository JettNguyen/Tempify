import { useState } from 'react'
import './ShareButton.css'

export default function ShareButton({ emojiGrid, gameSlug }) {
  const [copied, setCopied] = useState(false)

  function handleShare() {
    const gameName = {
      'one-bar': 'One Bar',
      'drop-or-flop': 'Drop or Flop',
      'who-sampled-it': 'Who Sampled It',
      'era': 'Era',
      'cover-or-not': 'Cover or Not',
    }[gameSlug] || 'Tempify'

    const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? ''
    const url = window.location.origin + base
    const text = `${emojiGrid || ''}\n${gameName} — ${url}`
    navigator.clipboard.writeText(text.trim()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleShare}
      className={`share-btn btn-press btn-hover${copied ? ' share-btn--copied' : ''}`}
    >
      {copied ? 'Copied' : 'Share'}
    </button>
  )
}
