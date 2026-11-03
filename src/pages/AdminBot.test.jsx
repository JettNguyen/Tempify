// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'

// The database as the page sees it: rows to read, and every update it sends.
const db = vi.hoisted(() => ({ items: [], log: [], settings: [], fail: false, noSettings: false, updates: [] }))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'admin@example.com' }, loading: false }),
}))

vi.mock('./AdminPlayers', () => ({ PlayCounts: () => null }))

vi.mock('../lib/oauth', () => ({ isNativeApp: () => false }))

vi.mock('../lib/supabase', () => {
  function query(table) {
    let patch = null
    const q = {
      select: () => q, or: () => q, order: () => q, limit: () => q,
      update: p => { patch = p; return q },
      eq: (col, val) => { if (patch) db.updates.push({ table, id: val, ...patch }); return q },
      then: (resolve, reject) => {
        const error = db.fail || (table === 'agent_settings' && db.noSettings) ? { message: 'relation does not exist' } : null
        const data = { agent_log: db.log, agent_settings: db.settings }[table] || db.items
        return Promise.resolve(patch ? { error } : { data: error ? null : data, error }).then(resolve, reject)
      },
    }
    return q
  }
  const storage = {
    from: () => ({
      createSignedUrls: async paths => ({ data: paths.map(path => ({ path, signedUrl: `https://signed.example/${path}` })), error: null }),
    }),
  }
  return { supabase: { from: query, storage } }
})

import AdminBot from './AdminBot'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container
let root

async function render() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root.render(<MemoryRouter><AdminBot /></MemoryRouter>)
  })
}

const button = label => [...container.querySelectorAll('button')].find(b => b.textContent === label)

async function click(label) {
  await act(async () => { button(label).dispatchEvent(new MouseEvent('click', { bubbles: true })) })
}

async function type(selector, value) {
  const el = container.querySelector(selector)
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set
  await act(async () => {
    setter.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

beforeEach(() => {
  vi.stubEnv('VITE_ADMIN_EMAIL', 'admin@example.com')
  db.fail = false
  db.noSettings = false
  db.settings = [{ post_at: '09:00:00' }]
  db.updates = []
  db.log = [{ id: 1, at: '2026-11-24T14:00:00Z', summary: 'Wrote Hit or Miss for Tue 11/24', failed: false }]
  db.items = [
    { id: 'p1', kind: 'post', title: 'Chart fact for 11/24', body: 'Yesterday: Creep peaked at #34.', place: 'Instagram', due_on: '2026-11-24', status: 'waiting' },
    { id: 'z1', kind: 'puzzle', title: 'Hit or Miss, Tue 11/24', body: 'Five songs', game_slug: 'hit-or-miss', puzzle_date: '2026-11-24', status: 'waiting' },
    { id: 'b1', kind: 'post', title: 'Reddit post 1', body: '', status: 'sent_back', note: 'Lead with Creep' },
  ]
})

afterEach(() => {
  vi.useRealTimers()
  act(() => root.unmount())
  container.remove()
  vi.unstubAllEnvs()
})

describe('the Tempify bot page', () => {
  it('shows what is waiting, what was sent back, and the log', async () => {
    await render()
    const text = container.textContent
    expect(text).toContain('To look at (2)')
    expect(text).toContain('Chart fact for 11/24')
    expect(text).toContain('Sent back, waiting on the bot')
    expect(text).toContain('Reddit post 1: Lead with Creep')
    expect(text).toContain('Wrote Hit or Miss for Tue 11/24')
  })

  it('approves a puzzle', async () => {
    await render()
    await click('Looks good')
    expect(db.updates).toEqual([expect.objectContaining({ table: 'agent_items', id: 'z1', status: 'approved' })])
    expect(db.updates[0].decided_at).toBeTruthy()
    expect(container.textContent).toContain('To look at (1)')
  })

  it('marks a post as posted, with its link', async () => {
    await render()
    await click('Posted')
    await type('input', 'https://instagram.com/p/abc')
    await click('Save')
    expect(db.updates).toEqual([expect.objectContaining({ id: 'p1', status: 'posted', link: 'https://instagram.com/p/abc' })])
  })

  it('needs a note to send something back', async () => {
    await render()
    await click('Send back')
    expect(button('Send back').disabled).toBe(true)
    await type('textarea', 'Use a song from the 90s')
    await click('Send back')
    expect(db.updates).toEqual([expect.objectContaining({ id: 'p1', status: 'sent_back', note: 'Use a song from the 90s' })])
    expect(container.textContent).toContain('Chart fact for 11/24: Use a song from the 90s')
  })

  it('shows a post\'s pictures and hands it to the bot to post', async () => {
    // 10 AM Eastern on Mon 11/2, three weeks before the post's day.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-02T15:00:00Z'))
    db.items = [{
      id: 'c1', kind: 'post', title: 'Chart fact for Tue 11/24', body: 'Where did it peak?', place: 'Instagram',
      due_on: '2026-11-24', status: 'waiting', auto_post: true,
      images: ['posts/2026-11-24/1.jpg', 'posts/2026-11-24/2.jpg', 'posts/2026-11-24/3.jpg'],
    }]
    await render()
    const pictures = [...container.querySelectorAll('img')].map(img => img.getAttribute('src'))
    expect(pictures).toEqual([1, 2, 3].map(n => `https://signed.example/posts/2026-11-24/${n}.jpg`))
    expect(button('Posted')).toBeUndefined()
    expect(container.textContent).toContain('Auto-posts to Instagram')
    expect(container.textContent).toContain('Approve it and the bot puts it on Instagram on Tue Nov 24 at 9 AM.')
    await click('Approve to post')
    expect(db.updates).toEqual([expect.objectContaining({ id: 'c1', status: 'approved' })])
    expect(container.textContent).toContain('Posting soon')
    expect(container.textContent).toContain('Chart fact for Tue 11/24: the bot posts it on Tue Nov 24 at 9 AM.')
  })

  it('says a post approved on its own day goes up at the next check', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-03T15:00:00Z'))
    db.items = [{ id: 'c2', kind: 'post', title: 'Chart fact for Tue 11/3', body: 'x', place: 'Instagram', due_on: '2026-11-03', status: 'approved', auto_post: true }]
    await render()
    expect(container.textContent).toContain('Chart fact for Tue 11/3: the bot posts it within 15 minutes.')
  })

  it('shows the bot\'s line on whether the Reel gets its song, before and after approving', async () => {
    const line = 'No music: Instagram\'s music library doesn\'t have “No Secret” by DJ Khaled, so the Reel goes up without it.'
    db.items = [
      { id: 'm1', kind: 'post', title: 'Chart fact for Wed 11/4', body: 'x', place: 'Instagram', due_on: '2099-11-04', status: 'waiting', auto_post: true, bot_note: line },
      { id: 'm2', kind: 'post', title: 'Chart fact for Thu 11/5', body: 'x', place: 'Instagram', due_on: '2099-11-05', status: 'approved', auto_post: true, bot_note: 'Music: “Thriller 7"” by Michael Jackson, from Instagram\'s music library.' },
    ]
    await render()
    expect(container.textContent).toContain(line)
    expect(container.textContent).not.toContain('Your last note')
    expect(container.textContent).toContain('Chart fact for Thu 11/5: the bot posts it on Thu Nov 5 at 9 AM. Music: “Thriller 7"” by Michael Jackson')
  })

  it('plays a post\'s Reel above its pictures', async () => {
    db.items = [{
      id: 'r1', kind: 'post', title: 'Chart fact for Wed 11/4', body: 'x', place: 'Instagram',
      due_on: '2099-11-04', status: 'waiting', auto_post: true,
      images: ['posts/2099-11-04/reel.mp4', 'posts/2099-11-04/reel-cover.jpg'],
    }]
    await render()
    expect(container.querySelector('video').getAttribute('src')).toBe('https://signed.example/posts/2099-11-04/reel.mp4')
    expect([...container.querySelectorAll('img')].map(img => img.getAttribute('src')))
      .toEqual(['https://signed.example/posts/2099-11-04/reel-cover.jpg'])
  })

  it('treats an auto-post whose day has passed like a post by hand', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-04T15:00:00Z'))
    db.items = [{ id: 'c3', kind: 'post', title: 'Chart fact for Tue 11/3', body: 'x', place: 'Instagram', due_on: '2026-11-03', status: 'waiting', auto_post: true }]
    await render()
    expect(container.textContent).not.toContain('Auto-posts to Instagram')
    expect(button('Approve to post')).toBeUndefined()
    expect(button('Posted')).toBeTruthy()
    expect(container.textContent).toContain("Its day has passed, so the bot won't post it.")
  })

  it('posts at the time set in Admin, and saves a new one', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-02T15:00:00Z'))
    db.settings = [{ post_at: '07:30:00' }]
    db.items = [{ id: 'c4', kind: 'post', title: 'Chart fact for Tue 11/24', body: 'x', place: 'Instagram', due_on: '2026-11-24', status: 'approved', auto_post: true }]
    await render()
    expect(container.textContent).toContain('Chart fact for Tue 11/24: the bot posts it on Tue Nov 24 at 7:30 AM.')
    expect(container.querySelector('input[type="time"]').value).toBe('07:30')
    await type('input[type="time"]', '12:15')
    await click('Save time')
    expect(db.updates).toEqual([expect.objectContaining({ table: 'agent_settings', id: true, post_at: '12:15' })])
    expect(container.textContent).toContain('Chart fact for Tue 11/24: the bot posts it on Tue Nov 24 at 12:15 PM.')
  })

  it('says a post approved before the time on its day goes up today at that time', async () => {
    // 7 AM Eastern on Tue 11/3.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-03T12:00:00Z'))
    db.settings = [{ post_at: '08:00:00' }]
    db.items = [{ id: 'c5', kind: 'post', title: 'Chart fact for Tue 11/3', body: 'x', place: 'Instagram', due_on: '2026-11-03', status: 'approved', auto_post: true }]
    await render()
    expect(container.textContent).toContain('Chart fact for Tue 11/3: the bot posts it today at 8 AM.')
  })

  it('keeps 9 AM and says why before migration 017 has run', async () => {
    db.noSettings = true
    await render()
    expect(container.querySelector('input[type="time"]')).toBeNull()
    expect(container.textContent).toContain('The bot posts at 9 AM Eastern for now.')
    expect(container.textContent).toContain('To look at (2)')
  })

  it('says what to do before migration 015 has run', async () => {
    db.fail = true
    await render()
    expect(container.textContent).toContain('It starts once migration 015 has run')
  })
})
