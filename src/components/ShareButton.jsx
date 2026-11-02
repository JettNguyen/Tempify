import { useState, useRef, useEffect } from 'react'
import Icon from './Icon'
import { Share } from '@capacitor/share'
import { fmtTime, fmtDayNumber, todayEST } from '../lib/date'
import { isNativeApp } from '../lib/oauth'
import { siteUrl, shareQuery, replyLine } from '../lib/challenge'
import { GAME_BY_SLUG } from '../lib/games'
import { countShare } from '../lib/plays'
import { useAuth } from '../hooks/useAuth'
import './ShareButton.css'

function fmtShareDate(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const RESULT_LINES = {
  'one-bar': {
    win:  (n) => `Got it in ${n} guess${n !== 1 ? 'es' : ''} 🎯`,
    loss: ()  => `Couldn't name it`,
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

/**
 * `score` is the result a link can carry, `{ points }` song by song or
 * One Bar's `{ guesses }`, and `answering` the challenge this game was opened
 * from, with `total` the player's points to answer it with.
 */
export default function ShareButton({ emojiGrid, gameSlug, correct, attempts, timeSeconds, puzzleDate, resultLine: givenLine, score, total, answering }) {
  const { profile } = useAuth()
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
      'tempo':        'Tap the Tempo',
    }[gameSlug] || 'Tempify'

    // In the app the page's own address is capacitor://localhost, which no
    // one it's sent to can open, so links point at the public site.
    const where = { native: isNativeApp(), origin: window.location.origin, base: import.meta.env.BASE_URL || '/' }
    // The link opens this game on this day. Today's game goes out as a
    // challenge, with this result to beat, and so does an answer to one on any
    // day, so the friend who sent it sees how it went. An older day is passed
    // on as one worth playing, without a score to chase.
    const day = puzzleDate || todayEST()
    const today = day === todayEST()
    const challenging = Boolean(score) && (today || Boolean(answering))
    const path = GAME_BY_SLUG[gameSlug]?.path
    const query = shareQuery({ date: day, ...(challenging ? score : {}), name: challenging ? profile?.username : undefined })
    const url = siteUrl(path ? `${path}?${query}` : '', where)

    const header = [['Tempify', fmtDayNumber(day)].filter(Boolean).join(' '), gameName, fmtShareDate(day)]
      .filter(Boolean).join(' · ')

    // A points game writes its own line, since its score isn't a win or a loss.
    const lines = RESULT_LINES[gameSlug]
    const resultLine = givenLine || (lines
      ? (correct ? lines.win(attempts) : lines.loss(attempts))
      : (correct ? '✅' : '❌'))

    const parts = [header]
    if (emojiGrid) parts.push(emojiGrid)
    parts.push(resultLine)
    if (timeSeconds != null) parts.push(`⏱ ${fmtTime(timeSeconds)}`)
    // A miss has nothing to beat, only something to get.
    const missed = score ? score.guesses === 0 : total == null && !correct
    if (answering) parts.push(replyLine(answering, { total, guesses: score?.guesses }))
    else if (today) parts.push(missed ? 'Can you get it?' : 'Can you beat it?')
    else parts.push('Check this one out')

    const body = parts.join('\n')
    countShare(gameSlug, day, { challenge: challenging })

    // In the app, hand off to the system share sheet and pass the link
    // separately so Messages and friends render a real link preview.
    if (isNativeApp()) {
      try {
        await Share.share({ title: header, text: body, url, dialogTitle: 'Share your result' })
        return
      } catch (err) {
        // Dismissing the sheet rejects too, and that isn't a failure worth showing.
        if (/cancel/i.test(err?.message || '')) return
        // Otherwise fall through to the clipboard.
      }
    }

    const ok = await copyText(`${body}\n${url}`)
    setState(ok ? 'copied' : 'failed')
    clearTimeout(resetRef.current)
    resetRef.current = setTimeout(() => setState('idle'), 2000)
  }

  const label = state === 'copied' ? 'Copied' : state === 'failed' ? "Couldn't copy" : answering ? 'Send back' : 'Share'
  // The icon carries the state alongside the colour, so the result still reads
  // for anyone who can't tell the green from the red.
  const icon = state === 'copied' ? 'check' : state === 'failed' ? 'alert' : 'share'

  return (
    <button
      onClick={handleShare}
      className={`share-btn btn-press btn-hover${state === 'copied' ? ' share-btn--copied' : ''}${state === 'failed' ? ' share-btn--failed' : ''}`}
    >
      <Icon name={icon} size={14} />
      {label}
    </button>
  )
}
