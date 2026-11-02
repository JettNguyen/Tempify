import { describe, it, expect } from 'vitest'
import { bigScreenScale } from './useBigScreenScale.js'

const desktop = { native: false, mouse: true }

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

  it('never zooms the iPhone app or a touch screen', () => {
    expect(bigScreenScale({ native: true, mouse: true, width: 1920, height: 970 })).toBe(1)
    expect(bigScreenScale({ native: false, mouse: false, width: 1920, height: 970 })).toBe(1)
  })
})
