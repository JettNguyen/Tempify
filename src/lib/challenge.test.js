import { describe, it, expect } from 'vitest'
import { siteUrl, shareQuery, readChallenge, readGuessChallenge, compareGuesses, replyLine } from './challenge.js'

const params = (query) => new URLSearchParams(query)

describe('challenge links', () => {
  it('round trips a day of points and a name', () => {
    const query = shareQuery({ date: '2026-11-01', points: [850, 600, 1000, 0, 420], name: 'sam' })
    expect(readChallenge(params(query), 5)).toEqual({ name: 'sam', points: [850, 600, 1000, 0, 420], total: 2870 })
  })

  it('works without a name', () => {
    const query = shareQuery({ date: '2026-11-01', points: [1000, 0] })
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

  it('links to the day alone when there is no result to beat', () => {
    expect(shareQuery({ date: '2026-10-20', name: 'sam' })).toBe('date=2026-10-20&s=share')
  })

  it('round trips One Bar guesses, a miss as 0', () => {
    expect(readGuessChallenge(params(shareQuery({ date: '2026-11-01', guesses: 3, name: 'sam' })), 6))
      .toEqual({ name: 'sam', guesses: 3 })
    expect(readGuessChallenge(params(shareQuery({ date: '2026-11-01', guesses: 0 })), 6))
      .toEqual({ name: null, guesses: 0 })
    expect(readGuessChallenge(params('vs=9'), 6)).toBe(null)
    expect(readGuessChallenge(params('vs=850.600'), 6)).toBe(null)
    expect(readGuessChallenge(params('date=2026-11-01'), 6)).toBe(null)
  })

  it('ranks getting it over missing it, then fewer guesses', () => {
    expect(compareGuesses(2, 4)).toBe(1)
    expect(compareGuesses(6, 0)).toBe(1)
    expect(compareGuesses(0, 1)).toBe(-1)
    expect(compareGuesses(3, 3)).toBe(0)
    expect(compareGuesses(0, 0)).toBe(0)
  })

  it('answers a challenge to the friend who sent it', () => {
    const points = { name: 'sam', points: [1000, 2200], total: 3200 }
    expect(replyLine(points, { total: 3450 })).toBe('Beat your 3,200 by 250')
    expect(replyLine(points, { total: 3000 })).toBe('You won by 200')
    expect(replyLine(points, { total: 3200 })).toBe('Tied you at 3,200')
    expect(replyLine({ name: 'sam', guesses: 4 }, { guesses: 2 })).toBe('Beat you, 2 guesses to your 4')
    expect(replyLine({ name: 'sam', guesses: 0 }, { guesses: 5 })).toBe("Beat you, I got it and you didn't")
    expect(replyLine({ name: 'sam', guesses: 1 }, { guesses: 3 })).toBe('You won, 1 guess to my 3')
    expect(replyLine({ name: 'sam', guesses: 2 }, { guesses: 0 })).toBe('You won this one')
    expect(replyLine({ name: 'sam', guesses: 0 }, { guesses: 0 })).toBe('Neither of us got it')
  })

  it('links to the public site from inside the app', () => {
    expect(siteUrl('/game/tempo', { native: true, origin: 'capacitor://localhost' }))
      .toBe('https://tempify.me/game/tempo')
    expect(siteUrl('/game/tempo', { origin: 'http://localhost:5199' }))
      .toBe('http://localhost:5199/game/tempo')
  })
})
