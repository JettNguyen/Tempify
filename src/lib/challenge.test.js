import { describe, it, expect } from 'vitest'
import { siteUrl, challengeQuery, readChallenge } from './challenge.js'

const params = (query) => new URLSearchParams(query)

describe('challenge links', () => {
  it('round trips a day of points and a name', () => {
    const query = challengeQuery({ date: '2026-11-01', points: [850, 600, 1000, 0, 420], name: 'sam' })
    expect(readChallenge(params(query), 5)).toEqual({ name: 'sam', points: [850, 600, 1000, 0, 420], total: 2870 })
  })

  it('works without a name', () => {
    const query = challengeQuery({ date: '2026-11-01', points: [1000, 0] })
    expect(readChallenge(params(query), 2)).toEqual({ name: null, points: [1000, 0], total: 1000 })
  })

  it('ignores a link made for a different puzzle', () => {
    expect(readChallenge(params('vs=850.600.1000'), 5)).toBe(null)
  })

  it('ignores points no round could score', () => {
    expect(readChallenge(params('vs=850.600.5000.0.420'), 5)).toBe(null)
    expect(readChallenge(params('vs=850.-1.0.0.420'), 5)).toBe(null)
    expect(readChallenge(params('vs=850.abc.0.0.420'), 5)).toBe(null)
  })

  it('has no challenge on a plain game link', () => {
    expect(readChallenge(params('date=2026-11-01'), 5)).toBe(null)
  })

  it('links to the public site from inside the app', () => {
    expect(siteUrl('/game/tempo', { native: true, origin: 'capacitor://localhost' }))
      .toBe('https://tempify.me/game/tempo')
    expect(siteUrl('/game/tempo', { origin: 'http://localhost:5199' }))
      .toBe('http://localhost:5199/game/tempo')
  })
})
