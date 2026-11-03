import { describe, expect, it } from 'vitest'
import { nextGameAfter, roundCount } from './games'

describe('nextGameAfter', () => {
  it('follows the lineup', () => {
    expect(nextGameAfter('one-bar', '2026-11-03')).toEqual({ path: '/game/hit-or-miss', label: 'Hit or Miss' })
    expect(nextGameAfter('era', '2026-11-03')).toEqual({ path: '/game/cover-or-not', label: 'Cover or Not' })
  })

  it('goes from Cover or Not to Tap the Tempo once it has launched', () => {
    expect(nextGameAfter('cover-or-not', '2026-11-02')).toEqual({ path: '/game/tempo', label: 'Tap the Tempo' })
  })

  it('ends at the list on a day before Tap the Tempo, and after the last game', () => {
    expect(nextGameAfter('cover-or-not', '2026-11-01')).toEqual({ path: '/', label: 'Back to games' })
    expect(nextGameAfter('tempo', '2026-11-03')).toEqual({ path: '/', label: 'Back to games' })
  })
})

describe('roundCount', () => {
  it('is three for Hit or Miss and Tap the Tempo from 11/17/2026', () => {
    expect(roundCount('hit-or-miss', '2026-11-17')).toBe(3)
    expect(roundCount('tempo', '2026-12-01')).toBe(3)
  })

  it('stays five for the days before, and for Era', () => {
    expect(roundCount('hit-or-miss', '2026-11-16')).toBe(5)
    expect(roundCount('tempo', '2026-11-03')).toBe(5)
    expect(roundCount('era', '2026-11-17')).toBe(5)
  })

  it('is the count for a day written now when there is no date', () => {
    expect(roundCount('hit-or-miss')).toBe(3)
    expect(roundCount('era')).toBe(5)
  })
})
