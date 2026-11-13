import { describe, it, expect } from 'vitest'
import { bigScreenScale, isTablet, refits } from './useBigScreenScale.js'

const desktop = { native: false, mouse: true }
const app = { native: true, mouse: false }
const touch = { native: false, mouse: false }

describe('bigScreenScale', () => {
  it('fills the height of a 1080p browser window', () => {
    // Chrome on a 1920 by 1080 screen leaves about 970 for the page.
    expect(bigScreenScale({ ...desktop, width: 1920, height: 970 })).toBe(1.25)
  })

  it('stops at 1.5 on a very big window', () => {
    expect(bigScreenScale({ ...desktop, width: 2560, height: 1330 })).toBe(1.5)
  })

  it('leaves a laptop-sized window alone', () => {
    expect(bigScreenScale({ ...desktop, width: 1366, height: 650 })).toBe(1)
  })

  it('is held back by a narrow window', () => {
    expect(bigScreenScale({ ...desktop, width: 1100, height: 1000 })).toBe(1.1)
  })

  it('never zooms a phone, in the app or a browser, either way up', () => {
    for (const [width, height] of [[390, 844], [844, 390], [440, 956], [956, 440], [375, 667]]) {
      expect(bigScreenScale({ ...app, width, height })).toBe(1)
      expect(bigScreenScale({ ...touch, width, height })).toBe(1)
    }
  })
})

describe('bigScreenScale on a tablet', () => {
  it('fits each iPad standing up', () => {
    expect(bigScreenScale({ ...app, width: 744, height: 1133 })).toBe(1.2) // mini
    expect(bigScreenScale({ ...app, width: 768, height: 1024 })).toBe(1.2)
    expect(bigScreenScale({ ...app, width: 820, height: 1180 })).toBe(1.35) // Air 11"
    expect(bigScreenScale({ ...app, width: 1024, height: 1366 })).toBe(1.5) // 13"
  })

  it('fits an iPad on its side by its height', () => {
    expect(bigScreenScale({ ...app, width: 1366, height: 1024 })).toBe(1.2)
    // An 11" on its side is a little short of room for the zoom.
    expect(bigScreenScale({ ...app, width: 1180, height: 820 })).toBe(1)
  })

  it('fits iPad Safari the same way, in the room its toolbars leave', () => {
    expect(bigScreenScale({ ...touch, width: 768, height: 1024 })).toBe(1.2)
    expect(bigScreenScale({ ...touch, width: 820, height: 1106 })).toBe(1.3)
  })

  it('treats a touch screen with a trackpad in a browser as a desktop', () => {
    // Too narrow for the desktop fit, so it keeps the layout it had.
    expect(bigScreenScale({ ...desktop, width: 820, height: 1106 })).toBe(1)
  })

  it('keeps fitting the app as a tablet with a trackpad', () => {
    expect(bigScreenScale({ native: true, mouse: true, width: 820, height: 1180 })).toBe(1.35)
  })
})

describe('isTablet', () => {
  it('counts an iPad in the app or in Safari', () => {
    expect(isTablet({ ...app, width: 744, height: 1133 })).toBe(true)
    expect(isTablet({ ...app, width: 1133, height: 744 })).toBe(true)
    expect(isTablet({ ...touch, width: 1366, height: 1024 })).toBe(true)
  })

  it('never counts a phone', () => {
    expect(isTablet({ ...app, width: 440, height: 956 })).toBe(false)
    expect(isTablet({ ...touch, width: 956, height: 440 })).toBe(false)
  })

  it('never counts a desktop window', () => {
    expect(isTablet({ ...desktop, width: 1920, height: 970 })).toBe(false)
  })
})

describe('refits', () => {
  it('fits a desktop window again on any resize', () => {
    expect(refits({ ...desktop, width: 1920, fittedWidth: 1920 })).toBe(true)
  })

  it('leaves a tablet alone when only its height changes, as for the keyboard', () => {
    expect(refits({ ...app, width: 820, fittedWidth: 820 })).toBe(false)
    expect(refits({ ...touch, width: 820, fittedWidth: 820 })).toBe(false)
    expect(refits({ native: true, mouse: true, width: 820, fittedWidth: 820 })).toBe(false)
  })

  it('fits a tablet again when it turns', () => {
    expect(refits({ ...app, width: 1180, fittedWidth: 820 })).toBe(true)
    expect(refits({ ...touch, width: 1180, fittedWidth: 820 })).toBe(true)
  })

  it('fits the first time', () => {
    expect(refits({ ...app, width: 820, fittedWidth: null })).toBe(true)
  })
})
