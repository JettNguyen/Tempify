import { describe, it, expect } from 'vitest'
import {
  customQuery, customUrl, customTitle, makerTag, customPuzzle, isCustomCode, inviteText, saveErrorText, customNext,
} from './customGames.js'
import { readChallenge, readGuessChallenge } from './challenge.js'

const game = { code: '3f9a01b2ce', slug: 'era', maker: 'dana', rounds: [{}, {}, {}, {}] }

describe('made game links', () => {
  it('opens the game on its own page, with the maker for the preview', () => {
    expect(customUrl(game, null, { native: true })).toBe('https://tempify.me/game/era?c=3f9a01b2ce&m=dana')
  })

  it('carries a score as a challenge the game already reads', () => {
    const query = customQuery({ code: game.code, maker: 'dana', points: [1000, 500, 0], name: 'sam' })
    expect(query).toBe('c=3f9a01b2ce&m=dana&vs=1000.500.0&by=sam')
    expect(readChallenge(new URLSearchParams(query), 3)).toEqual({ name: 'sam', points: [1000, 500, 0], total: 1500 })
  })

  it("carries One Bar's guesses, a miss as 0", () => {
    const query = customQuery({ code: game.code, guesses: 0, name: 'sam' })
    expect(query).toBe('c=3f9a01b2ce&vs=0&by=sam')
    expect(readGuessChallenge(new URLSearchParams(query), 6)).toEqual({ name: 'sam', guesses: 0 })
  })

  it('leaves the name off a link with no score, and cuts a long maker', () => {
    expect(customQuery({ code: game.code, name: 'sam' })).toBe('c=3f9a01b2ce')
    expect(customQuery({ code: game.code, maker: 'x'.repeat(40) })).toBe(`c=3f9a01b2ce&m=${'x'.repeat(24)}`)
  })

  it('takes only the codes the database makes', () => {
    expect(isCustomCode('3f9a01b2ce')).toBe(true)
    expect(isCustomCode('3F9A01B2CE')).toBe(false)
    expect(isCustomCode('3f9a01b2c')).toBe(false)
    expect(isCustomCode(null)).toBe(false)
  })
})

describe('how a made game is named', () => {
  it('names its maker, or the player who made it', () => {
    expect(customTitle({ maker: 'dana', slug: 'hit-or-miss' })).toBe("dana's Hit or Miss")
    expect(customTitle({ maker: null, slug: 'era' })).toBe("A friend's Era")
    expect(customTitle({ maker: 'dana', mine: true, slug: 'one-bar' })).toBe('Your One Bar')
    expect(makerTag({ maker: 'dana' })).toBe('by dana')
    expect(makerTag({ maker: 'dana', mine: true })).toBe('your game')
  })

  it('says how many songs are in it', () => {
    expect(inviteText(game)).toBe('I picked 4 songs for you on Tempify. Can you put them in order by year?')
    expect(inviteText({ ...game, slug: 'one-bar', rounds: [{}] })).toMatch(/^I picked a song/)
  })

  it('sends the maker back to their games, and a friend to make one', () => {
    expect(customNext({ mine: true }).label).toBe('Your games')
    expect(customNext({ mine: false })).toEqual({ path: '/make', label: 'Make your own' })
  })
})

describe('the puzzle a game screen gets', () => {
  it("puts One Bar's song where the daily puzzle keeps it", () => {
    const song = { title: 'Dreams', artist: 'Fleetwood Mac', audio_url: 'https://audio-ssl.itunes.apple.com/a.m4a', artwork_url: 'x' }
    expect(customPuzzle({ code: 'c', slug: 'one-bar', rounds: [song] })).toEqual({
      id: 'c',
      game_slug: 'one-bar',
      answer: 'Dreams',
      audio_url: song.audio_url,
      metadata: { artist: 'Fleetwood Mac', artwork_url: 'x' },
    })
  })

  it('hands Era and Hit or Miss their rounds', () => {
    expect(customPuzzle(game).metadata.rounds).toBe(game.rounds)
  })
})

describe('a save that was turned down', () => {
  it('says what to do', () => {
    expect(saveErrorText({ message: 'premium only' })).toMatch(/Refresh status/)
    expect(saveErrorText({ message: 'too many today' })).toMatch(/tomorrow/)
    expect(saveErrorText(null)).toMatch(/connection/)
  })
})
