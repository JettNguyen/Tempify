import { useState } from 'react'

export default function ShareButton({ emojiGrid, gameSlug }) {
  const [copied, setCopied] = useState(false)

  function handleShare() {
    const gameName = {
      'one-bar': 'One Bar',
      'drop-or-flop': 'Drop or Flop',
      'who-sampled-it': 'Who Sampled It',
      'era': 'Era',
      'the-flip': 'The Flip',
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
      className="btn-press btn-hover"
      style={{
        fontSize: '13px',
        color: copied ? 'var(--green)' : 'var(--text-muted)',
        padding: '7px 14px',
        border: '1px solid var(--border)',
        borderRadius: '999px',
        transition: 'color 100ms ease',
      }}
    >
      {copied ? 'Copied' : 'Share'}
    </button>
  )
}
