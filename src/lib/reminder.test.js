import { describe, it, expect, vi } from 'vitest'

vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: {} }))
const { reminderTimes, fmtReminderTime } = await import('./reminder.js')

const at = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi)

describe('when reminders go out', () => {
  it('books seven days, starting today when the time is still ahead', () => {
    const times = reminderTimes(at(2026, 11, 2, 7), '09:00', false)
    expect(times).toHaveLength(7)
    expect(times[0]).toEqual(at(2026, 11, 2, 9))
    expect(times[6]).toEqual(at(2026, 11, 8, 9))
  })

  it('starts tomorrow once today is played', () => {
    expect(reminderTimes(at(2026, 11, 2, 7), '09:00', true)[0]).toEqual(at(2026, 11, 3, 9))
  })

  it('starts tomorrow once today’s time has passed', () => {
    const times = reminderTimes(at(2026, 11, 2, 21), '09:00', false)
    expect(times[0]).toEqual(at(2026, 11, 3, 9))
    expect(times).toHaveLength(7)
  })

  it('crosses into a new month', () => {
    expect(reminderTimes(at(2026, 11, 29, 10), '09:30', false).at(-1)).toEqual(at(2026, 12, 6, 9, 30))
  })
})

describe('reminder times on screen', () => {
  it('reads the way people say them', () => {
    expect(fmtReminderTime('09:00')).toBe('9 AM')
    expect(fmtReminderTime('00:00')).toBe('12 AM')
    expect(fmtReminderTime('12:00')).toBe('12 PM')
    expect(fmtReminderTime('21:30')).toBe('9:30 PM')
  })
})
