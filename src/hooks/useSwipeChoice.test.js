import { describe, it, expect } from 'vitest'
import { swipePick, PICK_AT } from './useSwipeChoice.js'

describe('swipePick', () => {
  const width = 360

  it('picks the side it was swiped to once it goes far enough', () => {
    expect(swipePick(-width * PICK_AT, width, 0)).toBe('left')
    expect(swipePick(width * PICK_AT + 1, width, 0)).toBe('right')
  })

  it('springs back from a short, slow swipe', () => {
    expect(swipePick(-40, width, -0.1)).toBe(null)
    expect(swipePick(60, width, 0.2)).toBe(null)
  })

  it('counts a quick flick that goes the same way', () => {
    expect(swipePick(-40, width, -0.9)).toBe('left')
    expect(swipePick(40, width, 1.2)).toBe('right')
  })

  it("doesn't count a flick back the other way, or a twitch", () => {
    expect(swipePick(60, width, -0.9)).toBe(null)
    expect(swipePick(10, width, 2)).toBe(null)
  })
})
