import { describe, it, expect } from 'vitest'
import { previewFor } from './preview.js'

const at = (path) => previewFor(new URL(`https://tempify.me${path}`))

describe('challenge link previews', () => {
  it('names the score to beat on a points game', () => {
    expect(at('/game/hit-or-miss?date=2026-11-02&vs=868.394.0.702.116&by=jett_n')).toEqual({
      title: 'jett_n scored 2,080 of 5,000 on Hit or Miss #189',
      description: 'Can you beat it?',
      url: 'https://tempify.me/game/hit-or-miss?date=2026-11-02&vs=868.394.0.702.116&by=jett_n',
    })
  })

  it("counts Cover or Not's two scores out of two thousand", () => {
    expect(at('/game/cover-or-not?date=2026-11-02&vs=1000.640&by=sam').title)
      .toBe('sam scored 1,640 of 2,000 on Cover or Not #189')
  })

  it('counts One Bar in guesses', () => {
    expect(at('/game/one-bar?date=2026-11-02&vs=3&by=sam').title).toBe('sam got One Bar #189 in 3 guesses')
    expect(at('/game/one-bar?date=2026-11-02&vs=1&by=sam').title).toBe('sam got One Bar #189 in 1 guess')
    expect(at('/game/one-bar?date=2026-11-02&vs=0&by=sam')).toMatchObject({
      title: "sam couldn't name One Bar #189",
      description: 'Can you?',
    })
  })

  it('says "A friend" when the link has no name, and cuts a long one', () => {
    expect(at('/game/era?date=2026-11-02&vs=1000.1000.1000.1000.1000').title)
      .toBe('A friend scored 5,000 of 5,000 on Era #189')
    expect(at(`/game/era?date=2026-11-02&vs=0&by=${'x'.repeat(80)}`).title)
      .toBe(`${'x'.repeat(24)} scored 0 of 1,000 on Era #189`)
  })

  it('names the day on a link with no score', () => {
    expect(at('/game/tempo?date=2026-10-30&s=share')).toEqual({
      title: 'Tap the Tempo #186 on Tempify',
      url: 'https://tempify.me/game/tempo?date=2026-10-30&s=share',
    })
  })

  it('leaves the page alone when the link makes no sense', () => {
    expect(at('/game/hit-or-miss')).toBe(null)
    expect(at('/game/not-a-game?date=2026-11-02&vs=1')).toBe(null)
    expect(at('/profile?vs=1')).toBe(null)
    expect(at('/game/hit-or-miss?date=2026-11-02&vs=850.5000')).toBe(null)
    expect(at('/game/one-bar?date=2026-11-02&vs=9')).toBe(null)
    expect(at('/game/era?date=2026-11-02&vs=abc')).toBe(null)
  })
})
