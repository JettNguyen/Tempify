import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gamePage, appPage, APP_PAGES } from './game-pages.js'
import { GAME_BY_SLUG } from '../src/lib/games.js'

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

describe('a page per game', () => {
  it("names the game in every part of the preview", () => {
    const page = gamePage(index, GAME_BY_SLUG['hit-or-miss'])
    expect(page).toContain('<meta property="og:title" content="Hit or Miss on Tempify" />')
    expect(page).toContain('<meta property="og:description" content="How high did each song chart on the Hot 100?" />')
    expect(page).toContain('<meta property="og:url" content="https://tempify.me/game/hit-or-miss" />')
    expect(page).toContain('<meta name="description" content="Hit or Miss on Tempify: How high did each song chart on the Hot 100?" />')
  })

  it('keeps the rest of the app as it is', () => {
    const page = gamePage(index, GAME_BY_SLUG.era)
    expect(page).toContain('<div id="root"></div>')
    expect(page).toContain('<meta property="og:image" content="https://tempify.me/og-card.png" />')
  })

  it('works for every game, retired ones too', () => {
    for (const game of Object.values(GAME_BY_SLUG)) {
      expect(gamePage(index, game)).toContain(`${game.name} on Tempify`)
    }
  })

  it('escapes what a tag cannot hold', () => {
    const page = gamePage(index, { name: 'Rock & "Roll"', path: '/game/x', description: 'a < b' })
    expect(page).toContain('content="Rock &amp; &quot;Roll&quot; on Tempify"')
    expect(page).toContain('content="a &lt; b"')
  })

  it('stops the build when index.html loses a tag', () => {
    expect(() => gamePage('<html></html>', GAME_BY_SLUG.era)).toThrow(/og:title/)
  })
})

describe("a page for each of the app's fixed addresses", () => {
  it('points the preview at its own address and keeps the app', () => {
    const page = appPage(index, 'privacy')
    expect(page).toContain('<meta property="og:url" content="https://tempify.me/privacy" />')
    expect(page).toContain('<div id="root"></div>')
  })

  it('covers the pages people link to directly', () => {
    expect(APP_PAGES).toEqual(expect.arrayContaining(['privacy', 'terms', 'support', 'login', 'signup']))
  })

  it('stops the build when index.html loses its og:url tag', () => {
    expect(() => appPage('<html></html>', 'terms')).toThrow(/og:url/)
  })
})
