// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'

// The database as the page sees it: rows to read, and every update it sends.
const db = vi.hoisted(() => ({ items: [], log: [], fail: false, updates: [] }))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'admin@example.com' }, loading: false }),
}))

vi.mock('./AdminPlayers', () => ({ PlayCounts: () => null }))

vi.mock('../lib/supabase', () => {
  function query(table) {
    let patch = null
    const q = {
      select: () => q, in: () => q, order: () => q, limit: () => q,
      update: p => { patch = p; return q },
      eq: (col, val) => { if (patch) db.updates.push({ table, id: val, ...patch }); return q },
      then: (resolve, reject) => {
        const error = db.fail ? { message: 'relation does not exist' } : null
        const data = table === 'agent_log' ? db.log : db.items
        return Promise.resolve(patch ? { error } : { data: error ? null : data, error }).then(resolve, reject)
      },
    }
    return q
  }
  return { supabase: { from: query } }
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
  db.updates = []
  db.log = [{ id: 1, at: '2026-11-24T14:00:00Z', summary: 'Wrote Hit or Miss for Tue 11/24', failed: false }]
  db.items = [
    { id: 'p1', kind: 'post', title: 'Chart fact for 11/24', body: 'Yesterday: Creep peaked at #34.', place: 'Instagram', due_on: '2026-11-24', status: 'waiting' },
    { id: 'z1', kind: 'puzzle', title: 'Hit or Miss, Tue 11/24', body: 'Five songs', game_slug: 'hit-or-miss', puzzle_date: '2026-11-24', status: 'waiting' },
    { id: 'b1', kind: 'post', title: 'Reddit post 1', body: '', status: 'sent_back', note: 'Lead with Creep' },
  ]
})

afterEach(() => {
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

  it('says what to do before migration 014 has run', async () => {
    db.fail = true
    await render()
    expect(container.textContent).toContain('It starts once migration 014 has run')
  })
})
