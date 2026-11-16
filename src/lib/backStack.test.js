import { describe, it, expect } from 'vitest'
import { stepsBack, isTabPath, MAX_DEPTH } from './backStack.js'

describe('stepsBack', () => {
  it('leaves the first page alone', () => {
    expect(stepsBack('/', 0)).toBe(0)
    expect(stepsBack('/game/era', 0)).toBe(0)
  })

  it('takes a tab back to the first entry, however deep', () => {
    expect(stepsBack('/', 1)).toBe(1)
    expect(stepsBack('/explore', 5)).toBe(5)
    expect(stepsBack('/profile', 30)).toBe(30)
  })

  it("treats your own profile as a tab and anyone else's as a page", () => {
    expect(stepsBack('/u/sam', 4, '/u/sam')).toBe(4)
    expect(stepsBack('/u/dana', 4, '/u/sam')).toBe(0)
    expect(stepsBack('/u/dana', 4)).toBe(0)
  })

  it('stacks pages up to the limit', () => {
    expect(stepsBack('/game/era', 1)).toBe(0)
    expect(stepsBack('/game/era', MAX_DEPTH)).toBe(0)
  })

  it('swaps out the page before once past the limit, so the stack stops growing', () => {
    expect(stepsBack('/game/era', MAX_DEPTH + 1)).toBe(1)
    expect(stepsBack('/u/dana', MAX_DEPTH + 9)).toBe(1)
  })

  it('clears what is behind a tab that replaced a page, like a game\'s Back link', () => {
    expect(stepsBack('/', 1, null, true)).toBe(1)
    expect(stepsBack('/explore', 3, null, true)).toBe(3)
  })

  it('leaves a replaced page that is not a tab where it is, even deep down', () => {
    expect(stepsBack('/game/era', 2, null, true)).toBe(0)
    expect(stepsBack('/game/era', MAX_DEPTH + 1, null, true)).toBe(0)
  })

  it('reads a page with a query by its path', () => {
    // The hook passes the pathname alone; a game with ?date= is still a page.
    expect(stepsBack('/archive/2026-11-02', 3)).toBe(0)
  })

  it('does nothing without a usable index', () => {
    expect(stepsBack('/', undefined)).toBe(0)
    expect(stepsBack('/', null)).toBe(0)
    expect(stepsBack('/', 1.5)).toBe(0)
  })
})

describe('isTabPath', () => {
  it('knows the tabs', () => {
    for (const p of ['/', '/explore', '/profile', '/admin']) expect(isTabPath(p)).toBe(true)
    for (const p of ['/game/one-bar', '/archive/2026-11-02', '/make', '/u/sam', '/admin/bot']) expect(isTabPath(p)).toBe(false)
  })
})
