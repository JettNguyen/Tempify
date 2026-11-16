import { describe, it, expect } from 'vitest'
import { appPathFor } from './appLinks.js'

describe('appPathFor', () => {
  it('keeps the whole of a challenge link', () => {
    expect(appPathFor('https://tempify.me/game/era?date=2026-11-15&vs=850.600.1000&by=sam'))
      .toBe('/game/era?date=2026-11-15&vs=850.600.1000&by=sam')
  })

  it('opens a game made for friends', () => {
    expect(appPathFor('https://tempify.me/game/one-bar?c=0a1b2c3d4e&m=dana')).toBe('/game/one-bar?c=0a1b2c3d4e&m=dana')
  })

  it('takes the www address too', () => {
    expect(appPathFor('https://www.tempify.me/u/sam')).toBe('/u/sam')
  })

  it('reads the bare site as home', () => {
    expect(appPathFor('https://tempify.me')).toBe('/')
    expect(appPathFor('https://tempify.me/')).toBe('/')
  })

  it('leaves the sign-in callback and other sites alone', () => {
    expect(appPathFor('me.tempify://auth/callback?code=abc')).toBe(null)
    expect(appPathFor('https://example.com/game/era')).toBe(null)
    expect(appPathFor('http://tempify.me/game/era')).toBe(null)
    expect(appPathFor('https://tempify.me.example.com/')).toBe(null)
  })

  it('has no path for a missing address', () => {
    expect(appPathFor(undefined)).toBe(null)
    expect(appPathFor('')).toBe(null)
  })
})
