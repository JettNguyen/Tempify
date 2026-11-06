import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { labelNowPlaying } from './nowPlaying.js'

class FakeMetadata {
  constructor(fields) { Object.assign(this, fields) }
}

describe('the lock screen label', () => {
  let session

  beforeEach(() => {
    session = {}
    vi.stubGlobal('navigator', { mediaSession: session })
    vi.stubGlobal('MediaMetadata', FakeMetadata)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('names the game being played', () => {
    labelNowPlaying('/game/one-bar')
    expect(session.metadata.title).toBe('One Bar')
    expect(session.metadata.artist).toBe('Tempify')
  })

  it('falls back to the app away from a game', () => {
    labelNowPlaying('/')
    expect(session.metadata.title).toBe('Tempify')
    labelNowPlaying('/game/not-a-game')
    expect(session.metadata.title).toBe('Tempify')
  })

  it('is fine in a browser without it', () => {
    vi.stubGlobal('navigator', {})
    expect(() => labelNowPlaying('/game/one-bar')).not.toThrow()
  })
})
