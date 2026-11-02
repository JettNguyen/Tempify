import { supabase } from './supabase'
import { todayEST } from './date'
import { isNativeApp } from './oauth'

// Anonymous play counts for Admin: how many people play, whether they come
// back, and how they found Tempify. A count never says who: no account, no
// device id. The device keeps its own list of days it played and sends only
// the tallies (first finish today? on how many of the last seven days?).
// The rows land through count_play() in migration 011.

const ARRIVAL_KEY = 'tempify_arrival'
const DAYS_KEY = 'tempify_play_days'

/**
 * How a visit started, from its first address and the page before it: a
 * challenge link carries vs=, a shared link s=share. Only the referring
 * site's host is kept ("reddit.com"), and never our own.
 */
export function arrivalFrom(search, referrer, ownHost) {
  const params = new URLSearchParams(search)
  const arrived = params.get('vs') ? 'challenge' : params.get('s') === 'share' ? 'share' : 'direct'
  let host = null
  try {
    host = new URL(referrer).hostname.replace(/^www\./, '') || null
  } catch {
    // No referrer, or not an address.
  }
  if (host && host === ownHost.replace(/^www\./, '')) host = null
  return { arrived, referrer: host }
}

function utcDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86400000
}

/** On how many of the seven days before `today` the device played. */
export function recentDays(days, today) {
  const t = utcDay(today)
  return new Set(days.filter(d => {
    const back = t - utcDay(d)
    return back >= 1 && back <= 7
  })).size
}

function readJson(storage, key, fallback) {
  try {
    return JSON.parse(storage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

/**
 * Notes how this visit started, once per tab. Run before the app renders,
 * while the address is still the one the visitor opened. A deep link passes
 * through 404.html first, which keeps the real referrer in spa-referrer,
 * since by the time the app loads the page before it is our own.
 */
export function noteArrival() {
  try {
    const bounced = sessionStorage.getItem('spa-referrer')
    sessionStorage.removeItem('spa-referrer')
    if (sessionStorage.getItem(ARRIVAL_KEY)) return
    const referrer = bounced ?? document.referrer
    sessionStorage.setItem(ARRIVAL_KEY, JSON.stringify(
      arrivalFrom(window.location.search, referrer, window.location.hostname)
    ))
  } catch {
    // Storage blocked: every visit counts as direct.
  }
}

function arrival() {
  if (isNativeApp()) return { arrived: 'direct', referrer: null }
  return readJson(sessionStorage, ARRIVAL_KEY, null) ?? { arrived: 'direct', referrer: null }
}

// Never in local development, which runs against the live database. The
// admin's own plays are left out by count_play() itself.
function send(args) {
  if (import.meta.env.DEV) return
  try {
    const { arrived, referrer } = arrival()
    supabase
      .rpc('count_play', {
        ...args,
        p_platform: isNativeApp() ? 'ios' : 'web',
        p_arrived: arrived,
        p_referrer: referrer,
      })
      .then(() => {}, () => {})
  } catch {
    // A count is never worth an error on screen.
  }
}

/** A game finished on this device. Call once per game and puzzle day. */
export function countPlay(gameSlug, puzzleDate) {
  const today = todayEST()
  let days = []
  try {
    const saved = readJson(localStorage, DAYS_KEY, [])
    if (Array.isArray(saved)) days = saved.filter(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
  } catch {
    // Storage blocked: counts as a first visit.
  }
  const firstToday = !days.includes(today)
  const recent = recentDays(days, today)
  if (firstToday) {
    try {
      const kept = [...days, today].filter(d => utcDay(today) - utcDay(d) <= 7)
      localStorage.setItem(DAYS_KEY, JSON.stringify(kept))
    } catch {
      // Storage blocked or full.
    }
  }
  send({
    p_kind: 'finish',
    p_game_slug: gameSlug,
    p_puzzle_date: puzzleDate,
    p_first_today: firstToday,
    p_recent_days: recent,
  })
}

/**
 * A tap on Share. `challenge` is whether the link carries a score to beat.
 * Returns nothing and never throws, so it needs no await.
 */
export function countShare(gameSlug, puzzleDate, { challenge = false } = {}) {
  send({
    p_kind: 'share',
    p_game_slug: gameSlug,
    p_puzzle_date: puzzleDate,
    p_challenge: Boolean(challenge),
  })
}
