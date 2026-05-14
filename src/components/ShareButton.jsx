import { useState } from 'react'
import { fmtTime } from '../lib/date'
import './ShareButton.css'

function fmtShareDate(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const RESULT_LINES = {
  'one-bar': {
    win:  (n) => `Got it in ${n} guess${n !== 1 ? 'es' : ''} 🎯`,
    loss: ()  => `Couldn't get it today`,
  },
  'hit-or-miss': {
    win:  () => `Knew it was a hit ✅`,
    loss: () => `Missed on this one`,
  },
  'sampled': {
    win:  () => `Found the sample ✅`,
    loss: () => `Couldn't place the sample`,
  },
  'era': {
    win:  () => `Nailed the decade ✅`,
    loss: () => `Got the wrong decade`,
  },
  'cover-or-not': {
    win:  () => `Spotted it correctly ✅`,
    loss: () => `Got fooled on this one`,
  },
}

export default function ShareButton({ emojiGrid, gameSlug, correct, attempts, timeSeconds, puzzleDate }) {
  const [copied, setCopied] = useState(false)

  function handleShare() {
    const gameName = {
      'one-bar':      'One Bar',
      'hit-or-miss':  'Hit or Miss',
      'sampled':      'Sampled',
      'era':          'Era',
      'cover-or-not': 'Cover or Not',
    }[gameSlug] || 'Tempify'

    const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? ''
    const url = window.location.origin + base

    const dateLabel = fmtShareDate(puzzleDate)
    const header = ['Tempify', gameName, dateLabel].filter(Boolean).join(' · ')

    const lines = RESULT_LINES[gameSlug]
    const resultLine = lines
      ? (correct ? lines.win(attempts) : lines.loss(attempts))
      : (correct ? '✅' : '❌')

    const parts = [header]
    if (emojiGrid) parts.push(emojiGrid)
    parts.push(resultLine)
    if (timeSeconds != null) parts.push(`⏱ ${fmtTime(timeSeconds)}`)
    parts.push(url)

    navigator.clipboard.writeText(parts.join('\n')).then(() => {
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
