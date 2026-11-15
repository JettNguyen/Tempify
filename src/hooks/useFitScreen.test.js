import { describe, it, expect } from 'vitest'
import { fitHeight, overflows } from './useFitScreen.js'

describe('fitHeight', () => {
  it('measures the screen the first time', () => {
    expect(fitHeight({}, { width: 393, height: 852 })).toEqual({ width: 393, height: 852 })
  })

  it('keeps the height through the keyboard or Safari toolbars, which change only the height', () => {
    const before = { width: 393, height: 852 }
    expect(fitHeight(before, { width: 393, height: 516 })).toBe(before)
  })

  it('measures again when the phone turns', () => {
    expect(fitHeight({ width: 393, height: 852 }, { width: 852, height: 393 })).toEqual({ width: 852, height: 393 })
  })
})

describe('overflows', () => {
  it('lets a page that fits, or fits within a pixel of rounding, stay as it is', () => {
    expect(overflows(852, 852)).toBe(false)
    expect(overflows(853, 852)).toBe(false)
  })

  it('folds a page that runs past the screen', () => {
    expect(overflows(880, 852)).toBe(true)
  })
})
