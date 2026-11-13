// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
// Node's own URL: the page's stand-in for it isn't one Node will read a file from.
import { URL as FileURL } from 'node:url'

const platform = vi.hoisted(() => ({ native: false }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => platform.native },
}))

const { lockZoomInApp, lockedViewport } = await import('./viewport.js')

const index = readFileSync(new FileURL('../../index.html', import.meta.url), 'utf8')
const shipped = index.match(/<meta name="viewport" content="([^"]*)"/)[1]

const viewport = () => document.querySelector('meta[name="viewport"]').getAttribute('content')

beforeEach(() => {
  document.head.innerHTML = `<meta name="viewport" content="${shipped}">`
})

describe('pinch zoom', () => {
  it('is open in the tag the website ships', () => {
    expect(shipped).not.toMatch(/user-scalable|maximum-scale/)
    expect(shipped).toContain('width=device-width')
    expect(shipped).toContain('viewport-fit=cover')
  })

  it('stays open on the web', () => {
    platform.native = false
    lockZoomInApp()
    expect(viewport()).toBe(shipped)
  })

  it('is locked in the iPhone app, and the rest of the tag is kept', () => {
    platform.native = true
    lockZoomInApp()
    expect(viewport()).toBe('width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no')
  })

  it('locks once, however many times it runs', () => {
    platform.native = true
    lockZoomInApp()
    lockZoomInApp()
    expect(viewport().match(/user-scalable/g)).toHaveLength(1)
  })

  it('locks an empty tag without a stray comma', () => {
    expect(lockedViewport('')).toBe('maximum-scale=1.0, user-scalable=no')
  })
})
