import { LocalNotifications } from '@capacitor/local-notifications'
import { isNativeApp } from './oauth'
import { todayEST, fmtDayNumber } from './date'
import { playedOn } from './plays'

// The daily reminder in the iPhone app, off until the player turns it on: one
// notification a day at the time they pick, "Tempify #190 / Today's songs are
// up." It's booked a week ahead and booked again each time the app opens or a
// game is finished, so it skips a day already played and goes quiet by itself
// after a week away.

const KEY = 'tempify_reminder'
const IDS = [4101, 4102, 4103, 4104, 4105, 4106, 4107]
export const DEFAULT_TIME = '09:00'

export function reminderAvailable() {
  return isNativeApp()
}

export function reminderSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    return {
      on: Boolean(saved?.on),
      time: /^\d{2}:\d{2}$/.test(saved?.time) ? saved.time : DEFAULT_TIME,
    }
  } catch {
    return { on: false, time: DEFAULT_TIME }
  }
}

function save(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // Storage blocked: the reminder stays as it was.
  }
}

/** "9 AM", "9:30 PM": a reminder time the way the screen says it. */
export function fmtReminderTime(time) {
  const [h, m] = time.split(':').map(Number)
  const hour = h % 12 || 12
  return `${hour}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`
}

/** The next seven reminder times after `now`, leaving out today if it's been played. */
export function reminderTimes(now, time, playedToday) {
  const [h, m] = time.split(':').map(Number)
  const times = []
  for (let i = 0; times.length < IDS.length; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, h, m)
    if (at <= now || (i === 0 && playedToday)) continue
    times.push(at)
  }
  return times
}

// Each reminder names the day it lands on, by the Eastern date the puzzles
// turn over on.
function dayLabel(at) {
  return `Tempify ${fmtDayNumber(at.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }))}`.trim()
}

/** Books the week ahead to match the settings. Safe to call any time. */
export async function refreshReminder() {
  if (!reminderAvailable()) return
  const { on, time } = reminderSettings()
  try {
    await LocalNotifications.cancel({ notifications: IDS.map(id => ({ id })) })
    if (!on) return
    const times = reminderTimes(new Date(), time, playedOn(todayEST()))
    await LocalNotifications.schedule({
      notifications: times.map((at, i) => ({
        id: IDS[i],
        title: dayLabel(at),
        body: "Today's songs are up.",
        schedule: { at, allowWhileIdle: true },
      })),
    })
  } catch {
    // A reminder is never worth an error on screen.
  }
}

/**
 * Turns the reminder on, asking iOS first. False when notifications are off
 * for Tempify, which only the Settings app can change.
 */
export async function turnOnReminder(time = reminderSettings().time) {
  try {
    const { display } = await LocalNotifications.requestPermissions()
    if (display !== 'granted') return false
  } catch {
    return false
  }
  save({ on: true, time })
  await refreshReminder()
  return true
}

export async function turnOffReminder() {
  save({ ...reminderSettings(), on: false })
  await refreshReminder()
}

export async function setReminderTime(time) {
  save({ ...reminderSettings(), time })
  await refreshReminder()
}
