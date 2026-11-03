import { describe, expect, it } from 'vitest'
import { nextGameAfter } from './games'

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
