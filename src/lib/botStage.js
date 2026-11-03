import { fmtDayShort, todayEST } from './date'

// Where a chart fact has got to, for Admin's Tempify bot page. The job that
// runs the phone (jobs/phone.py, in the bot's own workspace) says so only
// through a row's status, auto_post and bot_note, and bot_note is free text,
// so this reads the start of each line it writes. A line that isn't listed
// here still shows, word for word: the card just loses its stage, and with it
// Send back, since the page can't tell that sending it back is safe.

export const DEFAULT_POST_AT = '09:00'

// The bot's morning run, Eastern. It's the only thing that makes a sent-back
// card again.
const RUN_HOUR = 7

// How long a row can sit without the bot moving it before the page says so.
// The phone takes about 4 minutes a draft and can't be interrupted, so a share
// can run a few minutes behind with nothing wrong.
const STALL_MINUTES = 10

const LINES = [
  ['ready', /^Approve it and the phone makes it/],
  ['swapped', /^Instagram['’]s music doesn['’]t have .+, so this is now/],
  ['wait-make', /^Waiting for the Mac\b.*\bto make it\b/],
  ['wait-share', /^Waiting for the Mac\b.*\bto share it\b/],
  ['in-line', /^In line for the phone/],
  ['making', /^Making it on the phone/],
  ['retry-make', /^Couldn['’]t make it on the phone/],
  ['made', /^Made on the phone\b/],
  ['sharing', /^Sharing it from the phone/],
  ['retry-share', /^Couldn['’]t share it from the phone/],
  ['shared', /^Shared from the phone\b/],
]

// The lines that hand a chart fact back to Jett. The one about the puzzles comes
// from the bot's dashboard, and it's in note, the column that otherwise holds
// Jett's own words.
const HAND_BACKS = [
  ['no-draft', /^The phone couldn['’]t make it after \d+ tries/],
  ['day-passed', /^Its day passed before the phone could share it/],
  ['share-unseen', /^The phone tapped Share at /],
  ['no-song', /^Instagram['’]s music doesn['’]t have .+, and none of the day before['’]s other songs/],
  ['no-remake', /^Instagram['’]s music doesn['’]t have .+, and the bot couldn['’]t make the card again/],
  ['share-again', /^The phone already tapped Share on this one/],
]
const PUZZLES_CHANGED = /^The puzzles changed after this was made/

// What each line means once the bot has the card. Step counts along
// Approved, Draft, Share, Live: the one it's on now.
//
// Send back is only offered where it's known to be safe. Once a card is
// sharing, the job's last check of the status has passed, so a send back
// wouldn't stop the post. "Couldn't share" is fine: the job only writes it when
// Share wasn't tapped, and rereads the row before it tries again.
const WITH_BOT = {
  'picking-up': { label: 'Approved', soFar: 'The phone starts on it within a minute.', dot: 'line', step: 1, sendBack: true },
  'in-line': { label: 'In line', soFar: "It's in line for the phone.", dot: 'line', step: 1, sendBack: true },
  'wait-make': { label: 'Waiting on your Mac', dot: 'wait', step: 1, stuck: true, onMac: true, sendBack: true },
  making: { label: 'Making the draft', soFar: 'The phone is making the draft.', dot: 'work', step: 1, sendBack: true },
  'retry-make': { label: 'Trying again in 10 minutes', dot: 'wait', step: 1, stuck: true, sendBack: true },
  made: { label: 'Draft ready', soFar: 'The draft is ready.', dot: 'ready', step: 2, sendBack: true },
  'wait-share': { label: 'Waiting on your Mac', dot: 'wait', step: 2, stuck: true, onMac: true, sendBack: true },
  'retry-share': { label: 'Trying again in 10 minutes', dot: 'wait', step: 2, stuck: true, sendBack: true },
  sharing: { label: 'Sharing now', dot: 'work', step: 2, sendBack: false },
}

const TODO_MAC = 'Unlock the Mac and leave it alone for 30 seconds. Keep the phone nearby and locked.'
const TODO_ASLEEP = 'The Mac may be asleep or off. Wake it and leave it alone for 30 seconds.'

const toMinutes = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }

function nowMinutes() {
  return toMinutes(new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }))
}

function dayAfter(day) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/** '09:00' reads as 9 AM, '13:30' as 1:30 PM. */
export function fmtClock(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`
}

/** 42 minutes, 1 hour, 1 hour 5 minutes. */
export function fmtLate(mins) {
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  if (!hours) return plural(rest, 'minute')
  return rest ? `${plural(hours, 'hour')} ${plural(rest, 'minute')}` : plural(hours, 'hour')
}

function fmtLateShort(mins) {
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  if (!hours) return `${rest} min`
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`
}

/**
 * Which of the job's lines this is, 'handed-back' for a line that gave a card
 * back to Jett, 'unknown' for any other, null for none.
 */
export function lineKind(note) {
  if (!note) return null
  const found = LINES.find(([, pattern]) => pattern.test(note))
  if (found) return found[0]
  return HAND_BACKS.some(([, pattern]) => pattern.test(note)) ? 'handed-back' : 'unknown'
}

const SONG_IN_LINE = [
  /^Approve it and the phone makes it right away, with (“.+” by .+) from Instagram/,
  /so this is now (“.+” by .+), another of the day before/,
  /^Made on the phone with (“.+” by .+) under the voice/,
  /^Shared from the phone with (“.+” by .+?)\.?$/,
]

/**
 * The card's song as “X” by Y. Most of the job's lines don't name it, and the
 * caption always does.
 */
export function songOf(item) {
  for (const pattern of SONG_IN_LINE) {
    const match = item.bot_note?.match(pattern)
    if (match) return match[1]
  }
  return item.body?.match(/(“.+?” by .+?) peak on the Hot 100/)?.[1] || null
}

/** The song Instagram's music didn't have, on a card made again without it. */
export function swappedFrom(item) {
  return item.bot_note?.match(/doesn['’]t have “(.+?)”, so this is now/)?.[1] || null
}

/** What the draft is called in Reels drafts on the phone. */
export function draftName(item) {
  return item.bot_note?.match(/in Reels drafts as ([\d-]+)/)?.[1] || item.due_on
}

export const dayOf = item => (item.due_on ? fmtDayShort(item.due_on) : item.title)

export const isBotPost = item => item.kind === 'post' && !!item.auto_post
export const isChartFact = item => item.kind === 'post' && /instagram/i.test(item.place || '')
export const isDayOver = item => !!item.due_on && item.due_on < todayEST()

/** A post the bot has, from Jett's approval until it's up. */
export const isWithBot = item => item.status === 'approved' && isBotPost(item)

/**
 * Whether a row is waiting on Jett's answer. Games aren't: the bot approves
 * those itself, and they're live whatever happens here. Every post is.
 */
export const asksJett = item => item.status === 'waiting' && item.kind !== 'puzzle'

/**
 * A chart fact the bot gave up on, with its reason in bot_note, or in note for
 * the one about the puzzles. Reddit and Show HN posts have auto_post off too,
 * but no line from the bot and no Instagram.
 */
export const isHandedBack = item => item.status === 'waiting' && isChartFact(item) && !item.auto_post
  && (!!item.bot_note || PUZZLES_CHANGED.test(item.note || ''))

/** A chart fact whose day came and went before Jett approved it. */
export const isUnapprovedPastDay = item => item.status === 'waiting' && isBotPost(item) && isDayOver(item)

/**
 * A chart fact sent back too late for the 7 AM run. The run leaves a card alone
 * once its day has passed, so this one never comes back by itself.
 */
export const isSentBackTooLate = item => item.status === 'sent_back' && isChartFact(item) && missesDay(item)

export const needsJett = item => isHandedBack(item) || isUnapprovedPastDay(item) || isSentBackTooLate(item)

/** What's in note if Jett wrote it, which the line about the puzzles he didn't. */
export const jettsNote = item => (PUZZLES_CHANGED.test(item.note || '') ? null : item.note)

/** Minutes past the posting time, on the post's own day. */
export function lateMinutes(item, postAt) {
  if (item.due_on !== todayEST()) return 0
  return Math.max(0, nowMinutes() - toMinutes(postAt))
}

// The job writes these lines itself, so a row that stops moving means the job
// isn't running. A job that isn't running can't send its Telegram message
// either, so this is the only sign of it Jett gets.
function stallOf(item, key, late) {
  if (key === 'sharing') return null
  if (isDayOver(item)) {
    return { label: 'Its day passed', title: `The bot never finished ${dayOf(item)}`, detail: 'Its day has passed.' }
  }
  if (key === 'made' && late >= STALL_MINUTES) {
    return { label: "Hasn't started sharing", title: `The bot hasn't started sharing ${dayOf(item)}` }
  }
  if (key === 'picking-up' && item.decided_at && Date.now() - Date.parse(item.decided_at) > STALL_MINUTES * 60000) {
    return { label: 'Not picked up yet', title: `The bot hasn't picked up ${dayOf(item)}`, detail: `It was approved over ${STALL_MINUTES} minutes ago.` }
  }
  return null
}

/**
 * Where a card the bot has has got to: its label, dot, step, and what's allowed.
 * For up to a minute after Jett approves, the row still has the waiting line,
 * or the old hand-back line if it was remade by hand, since only the 7 AM run
 * rewrites that one. status and auto_post say the bot has it, so they win.
 */
export function stageOf(item, postAt) {
  const kind = lineKind(item.bot_note)
  const key = !kind || kind === 'ready' || kind === 'swapped' || kind === 'handed-back' ? 'picking-up' : kind
  const known = WITH_BOT[key]
  if (!known) return { key: 'unknown', label: item.bot_note, dot: 'plain', step: null, sendBack: false, late: 0 }
  const late = lateMinutes(item, postAt)
  const stall = stallOf(item, key, late)
  return stall
    ? { ...known, key, late, stall, label: stall.label, dot: 'wait', stuck: true }
    : { ...known, key, late }
}

/** The time on a card's row: when it goes up, or how late it is. */
export function rowWhen(item, stage, postAt) {
  if (isDayOver(item)) return 'Day passed'
  if (stage.stuck && stage.late > 0) return `${fmtLateShort(stage.late)} late`
  return `${item.due_on === todayEST() ? 'Today ' : ''}${fmtClock(postAt)}`
}

/** When a card goes up once it's approved, to finish a sentence. */
export function goesUpWhen(item, postAt) {
  const today = todayEST()
  if (item.due_on && item.due_on > today) return `on ${fmtDayShort(item.due_on)} at ${fmtClock(postAt)}`
  if (item.due_on === today && lateMinutes(item, postAt) === 0) return `today at ${fmtClock(postAt)}`
  return 'today, once the draft is made and the Mac is free'
}

/** The day of the next run that can make a sent-back card again. */
export function nextRunDay() {
  const today = todayEST()
  return nowMinutes() < RUN_HOUR * 60 ? today : dayAfter(today)
}

/** Whether a card sent back now comes back only after its day. */
export const missesDay = item => !!item.due_on && nextRunDay() > item.due_on

const runDayWord = () => (nextRunDay() === todayEST() ? 'today' : 'tomorrow')

/** What sending this card back costs, for the box you write the note in. */
export function sendBackWarning(item, postAt) {
  if (!isChartFact(item) || !item.due_on) return null
  const kind = handBackKind(item)
  if (kind === 'share-unseen' || kind === 'share-again') {
    return "The bot won't tap Share on this one again, so you'd still post it yourself."
  }
  if (missesDay(item)) {
    return "If you send this back, it won't go up. Only the 7 AM run makes a card again, and the next one comes after its day."
  }
  if (nextRunDay() === item.due_on) {
    const when = item.due_on === todayEST() ? 'today' : 'on its day'
    return `The 7 AM run makes it again ${when}. Approve it by ${fmtClock(postAt)} to keep it on time.`
  }
  return null
}

/** When a sent-back card comes back to be approved. */
export const backWhen = () => `Back ${runDayWord()} after 7 AM`

function handBackKind(item) {
  if (isSentBackTooLate(item)) return 'sent-too-late'
  if (isUnapprovedPastDay(item)) return 'unapproved'
  if (!isHandedBack(item)) return null
  if (PUZZLES_CHANGED.test(item.note || '')) return 'puzzles-changed'
  return HAND_BACKS.find(([, pattern]) => pattern.test(item.bot_note))?.[0] || 'unknown'
}

const POSTED_OR_SKIP = 'If you posted it yourself, tap Posted. If not, skip it.'

function handBackTodo(kind, item) {
  const remake = !missesDay(item)
  const over = isDayOver(item)
  const draft = `share the draft named ${draftName(item)} from Reels drafts on the phone if it's there, then tap Posted.`
  switch (kind) {
    case 'no-draft':
      if (over) return POSTED_OR_SKIP
      return remake
        ? 'Send it back for the 7 AM run to make again, or post it yourself and tap Posted. There may be no finished draft.'
        : 'Post it yourself and tap Posted, or skip it. There may be no finished draft.'
    case 'no-song':
    case 'no-remake':
      if (over) return POSTED_OR_SKIP
      return remake
        ? 'Send it back for the 7 AM run to try again, or post it without the song and tap Posted.'
        : 'Post it without the song and tap Posted, or skip it.'
    case 'share-unseen':
    case 'share-again':
      return `Check @tempify.me first, since it may be up. If it is, tap Posted. If it isn't, ${over ? 'skip it, since its day has passed.' : draft}`
    case 'day-passed':
      return "Nothing to do but skip it. Don't post it, since the caption would be wrong now, and sending it back won't help."
    case 'puzzles-changed':
      return remake ? "Don't post it. Send it back for the 7 AM run to try again." : "Don't post it. Skip it to clear it."
    case 'sent-too-late':
      return over ? POSTED_OR_SKIP : "It won't go up unless you post it yourself. If you do, tap Posted. If not, skip it."
    case 'unapproved':
      return POSTED_OR_SKIP
    default:
      return `Check Instagram first, since it may be up. If it is, tap Posted. If it isn't, ${draft} ${remake ? 'Or send it back for the 7 AM run to make again.' : "If there's no draft, skip it."}`
  }
}

const HAND_BACK_PILLS = {
  'share-unseen': 'Check Instagram',
  'share-again': 'Check Instagram',
  'day-passed': 'Its day passed',
  unapproved: 'Its day passed',
  'puzzles-changed': "Don't post this",
  'sent-too-late': "Won't go up",
}

/**
 * Why a chart fact needs Jett and what's left for him to do: the words for its
 * card, and which answers make sense. A hand-back line that isn't listed here
 * shows as it is, with a to-do that fits any of them.
 */
export function handBackOf(item) {
  const kind = handBackKind(item)
  const remake = !missesDay(item)
  const dontPost = kind === 'day-passed' || kind === 'puzzles-changed'
  const reasons = {
    unapproved: "Its day has passed, so the bot won't post it.",
    'sent-too-late': "You sent this back after the 7 AM run on its day, so the bot won't make it again.",
    'puzzles-changed': item.note,
  }
  return {
    kind,
    pill: HAND_BACK_PILLS[kind] || 'Handed back',
    reason: reasons[kind] || item.bot_note,
    todo: handBackTodo(kind, item),
    posted: !dontPost,
    back: remake && kind !== 'day-passed',
    skip: !remake || kind === 'day-passed',
    // Nothing to post from on a card that shouldn't be posted.
    media: !dontPost,
  }
}

/**
 * The one thing to know right now, for the top of the page: anything stuck,
 * then anything waiting on Jett, then what's next. It reads the time, so it's
 * worked out again every time the page checks.
 */
export function summarize(items, postAt) {
  const time = fmtClock(postAt)
  const withBot = items.filter(isWithBot).map(item => ({ item, stage: stageOf(item, postAt) }))

  const stalled = withBot.find(b => b.stage.stall)
  if (stalled) {
    const { title, detail } = stalled.stage.stall
    return { warn: true, title, detail: detail || `It was due at ${time}.`, todo: TODO_ASLEEP }
  }

  const macLate = withBot.find(b => b.stage.onMac && b.stage.late > 0)
  if (macLate) {
    return {
      warn: true,
      title: 'Waiting on your Mac',
      detail: `${dayOf(macLate.item)} was due at ${time}. It's ${fmtLate(macLate.stage.late)} late.`,
      todo: TODO_MAC,
    }
  }

  const onMac = withBot.filter(b => b.stage.onMac)
  if (onMac.length) {
    const who = onMac.length === 1 ? dayOf(onMac[0].item) : plural(onMac.length, 'chart fact')
    return { warn: true, title: 'Waiting on your Mac', detail: `${who} can't go ahead until it's free.`, todo: TODO_MAC }
  }

  const trying = withBot.find(b => b.stage.key.startsWith('retry') && b.stage.late > 0)
  if (trying) {
    const what = trying.stage.key === 'retry-share' ? 'share' : 'make'
    return {
      warn: true,
      title: `${dayOf(trying.item)} is running late`,
      detail: `The phone couldn't ${what} it, so it's trying again in 10 minutes.`,
      todo: 'Nothing to do yet. The bot hands it back to you if it gives up.',
    }
  }

  const stopped = items.filter(needsJett)
  if (stopped.length) {
    return {
      warn: true,
      title: stopped.length === 1 ? '1 card needs you' : `${stopped.length} cards need you`,
      detail: withBot.length ? "The bot can't take these any further. It's still working on the rest." : "The bot can't take these any further.",
    }
  }

  const swapped = items.find(i => i.status === 'waiting' && lineKind(i.bot_note) === 'swapped')
  if (swapped) {
    return {
      warn: true,
      title: `${dayOf(swapped)} has a new song`,
      detail: "Instagram's music doesn't have the old one, so the Reel was made again.",
      todo: 'Watch it, then approve it again.',
    }
  }

  // Soonest first, so a card waiting on Jett ahead of the approved ones means
  // that day has nothing set to go up.
  const coming = items
    .filter(i => (i.status === 'waiting' && isBotPost(i)) || isWithBot(i))
    .sort((a, b) => (a.due_on || '').localeCompare(b.due_on || ''))
  const next = coming[0]
  if (!next) return { title: 'Nothing lined up', detail: 'New chart facts show up here after the 7 AM run.' }

  const nextDay = next.due_on === todayEST() ? 'today' : dayOf(next)
  const song = songOf(next)
  if (next.status === 'waiting') {
    return {
      warn: true,
      title: next.due_on === todayEST() ? "Today's isn't approved yet" : `${dayOf(next)} isn't approved yet`,
      detail: 'Approve it and the phone makes the draft right away.',
    }
  }
  const stage = stageOf(next, postAt)
  if (stage.key === 'sharing') {
    return { title: `Sharing ${dayOf(next)} now`, detail: song ? `${song}.` : '' }
  }
  return {
    title: `Next up: ${nextDay} at ${time}`,
    detail: [song && `${song}.`, stage.soFar].filter(Boolean).join(' '),
  }
}
