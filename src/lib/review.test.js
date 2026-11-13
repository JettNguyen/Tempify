// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// The phone as review.js sees it: which platform, the app's version, the first
// day it played, today, and Apple's prompt.
const phone = vi.hoisted(() => ({
  platform: 'ios',
  version: '1.13',
  firstDay: '2026-11-10',
  today: '2026-11-13',
  getInfo: vi.fn(),
  requestReview: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => phone.platform } }))
vi.mock('@capacitor/app', () => ({ App: { getInfo: () => phone.getInfo() } }))
vi.mock('@capacitor-community/in-app-review', () => ({ InAppReview: { requestReview: () => phone.requestReview() } }))
vi.mock('./plays', () => ({ firstPlayDay: () => phone.firstDay }))
vi.mock('./date', () => ({ todayEST: () => phone.today }))

const { shouldAskForRating, askForRating } = await import('./review.js')

const wonDay = {
  platform: 'ios',
  won: true,
  custom: false,
  version: '1.13',
  askedVersion: null,
  firstDay: '2026-11-10',
  today: '2026-11-13',
}

describe('whether to ask for a rating', () => {
  it('asks after a won day in the iPhone app', () => {
    expect(shouldAskForRating(wonDay)).toBe(true)
  })

  it('never asks on the web', () => {
    expect(shouldAskForRating({ ...wonDay, platform: 'web' })).toBe(false)
    expect(shouldAskForRating({ ...wonDay, platform: 'android' })).toBe(false)
  })

  it('only asks after a day that was won', () => {
    expect(shouldAskForRating({ ...wonDay, won: false })).toBe(false)
  })

  it("doesn't count a game a friend made as a day", () => {
    expect(shouldAskForRating({ ...wonDay, custom: true })).toBe(false)
  })

  it('never asks on the first day someone plays', () => {
    expect(shouldAskForRating({ ...wonDay, firstDay: '2026-11-13' })).toBe(false)
    expect(shouldAskForRating({ ...wonDay, firstDay: null })).toBe(false)
  })

  it('asks at most once a version', () => {
    expect(shouldAskForRating({ ...wonDay, askedVersion: '1.13' })).toBe(false)
    expect(shouldAskForRating({ ...wonDay, askedVersion: '1.12' })).toBe(true)
  })

  it("doesn't ask without knowing the version", () => {
    expect(shouldAskForRating({ ...wonDay, version: '' })).toBe(false)
  })
})

describe('asking in the app', () => {
  beforeEach(() => {
    localStorage.clear()
    Object.assign(phone, { platform: 'ios', version: '1.13', firstDay: '2026-11-10', today: '2026-11-13' })
    phone.getInfo.mockReset().mockImplementation(async () => ({ version: phone.version }))
    phone.requestReview.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("asks once, then not again until the app's next version", async () => {
    expect(await askForRating({ won: true })).toBe(true)
    expect(await askForRating({ won: true })).toBe(false)
    expect(phone.requestReview).toHaveBeenCalledTimes(1)

    phone.version = '1.14'
    expect(await askForRating({ won: true })).toBe(true)
    expect(phone.requestReview).toHaveBeenCalledTimes(2)
  })

  it('leaves the web alone, without reading a version', async () => {
    phone.platform = 'web'
    expect(await askForRating({ won: true })).toBe(false)
    expect(phone.getInfo).not.toHaveBeenCalled()
    expect(phone.requestReview).not.toHaveBeenCalled()
  })

  it("waits for a day after someone's first", async () => {
    phone.firstDay = phone.today
    expect(await askForRating({ won: true })).toBe(false)
    phone.today = '2026-11-14'
    expect(await askForRating({ won: true })).toBe(true)
  })

  it("doesn't ask after a lost day or a friend's game", async () => {
    expect(await askForRating({ won: false })).toBe(false)
    expect(await askForRating({ won: true, custom: true })).toBe(false)
    expect(phone.requestReview).not.toHaveBeenCalled()
  })

  it("doesn't ask when the phone can't keep a note that it asked", async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full')
    })
    expect(await askForRating({ won: true })).toBe(false)
    expect(phone.requestReview).not.toHaveBeenCalled()
  })

  it("never throws when Apple's prompt fails", async () => {
    phone.requestReview.mockRejectedValue(new Error('no window'))
    await expect(askForRating({ won: true })).resolves.toBe(false)
  })
})
