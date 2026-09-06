import { useState, useRef, useEffect } from 'react'
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

// navigator.clipboard is missing or blocked in some webviews and on insecure
// origins, so fall back to a throwaway textarea before giving up. iOS refuses to
// copy from a readonly field and ignores select(), so the node has to be
// editable and selected through a Range as well as setSelectionRange().
function legacyCopy(text) {
  let area
  try {
    area = document.createElement('textarea')
    area.value = text
    area.contentEditable = 'true'
    area.readOnly = false
    area.style.position = 'fixed'
    area.style.top = '-9999px'
    area.style.opacity = '0'
    document.body.appendChild(area)

    const range = document.createRange()
    range.selectNodeContents(area)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    area.setSelectionRange(0, text.length)

    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    if (area?.parentNode) area.parentNode.removeChild(area)
  }
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the legacy path.
  }
  return legacyCopy(text)
}

export default function ShareButton({ emojiGrid, gameSlug, correct, attempts, timeSeconds, puzzleDate }) {
  const [state, setState] = useState('idle')
  const resetRef = useRef(null)

  useEffect(() => () => clearTimeout(resetRef.current), [])

  async function handleShare() {
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

    const ok = await copyText(parts.join('\n'))
    setState(ok ? 'copied' : 'failed')
    clearTimeout(resetRef.current)
    resetRef.current = setTimeout(() => setState('idle'), 2000)
  }

  const label = state === 'copied' ? 'Copied' : state === 'failed' ? "Couldn't copy" : 'Share'

  return (
    <button
      onClick={handleShare}
      className={`share-btn btn-press btn-hover${state === 'copied' ? ' share-btn--copied' : ''}${state === 'failed' ? ' share-btn--failed' : ''}`}
    >
      {label}
    </button>
  )
}
