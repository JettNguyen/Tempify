import { describe, it, expect } from 'vitest'
import { swipePick, flickVelocity, PICK_AT } from './useSwipeChoice.js'

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

describe('flickVelocity', () => {
  it('measures the last tenth of a second', () => {
    const points = [{ x: 0, t: 0 }, { x: 10, t: 200 }, { x: 40, t: 250 }, { x: 70, t: 300 }]
    expect(flickVelocity(points)).toBeCloseTo(60 / 100)
  })

  it('reads nothing from reports a few milliseconds apart', () => {
    expect(flickVelocity([{ x: 0, t: 100 }, { x: 40, t: 101 }])).toBe(0)
  })

  it('reads nothing once the finger has stopped', () => {
    expect(flickVelocity([{ x: 0, t: 0 }, { x: 80, t: 40 }, { x: 80, t: 400 }])).toBe(0)
  })

  it('is zero for a single point', () => {
    expect(flickVelocity([{ x: 5, t: 0 }])).toBe(0)
  })
})
