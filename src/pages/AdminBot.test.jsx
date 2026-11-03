// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'

// The database as the page sees it: rows to read, every update it sends, and
// every link it signs. An update only lands on rows that match all its filters,
// the way the real one does, so a save the page guards can really be turned down.
const db = vi.hoisted(() => ({
  items: [], log: [], settings: [], fail: false, noSettings: false, updates: [], signed: [], native: false, opened: [],
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'admin@example.com' }, loading: false }),
}))

vi.mock('./AdminPlayers', () => ({ PlayCounts: () => null }))

vi.mock('../lib/oauth', () => ({ isNativeApp: () => db.native }))

vi.mock('../lib/inAppBrowser', () => ({ openExternalUrlInApp: url => { db.opened.push(url) } }))

vi.mock('../lib/supabase', () => {
  function query(table) {
    let patch = null
    const filters = []
    const q = {
      select: () => q, or: () => q, order: () => q, limit: () => q,
      update: p => { patch = p; return q },
      eq: (col, val) => { filters.push([col, val]); return q },
      is: (col, val) => { filters.push([col, val]); return q },
      then: (resolve, reject) => {
        const error = db.fail || (table === 'agent_settings' && db.noSettings) ? { message: 'relation does not exist' } : null
        const finish = result => Promise.resolve(result).then(resolve, reject)
        if (table !== 'agent_items') {
          if (patch) {
            if (!error) db.updates.push({ table, id: filters[0][1], ...patch })
            return finish({ error })
          }
          return finish({ data: error ? null : { agent_log: db.log, agent_settings: db.settings }[table], error })
        }
        const rows = db.items.filter(row => filters.every(([col, val]) => (row[col] ?? null) === val))
        if (patch && !error) {
          rows.forEach(row => {
            db.updates.push({ table, id: row.id, ...patch })
            Object.assign(row, patch)
          })
        }
        // Copies, like the real one's JSON: what the page holds is what it saw,
        // and a test changing a row afterwards doesn't reach into it.
        return finish({ data: error ? null : rows.map(row => ({ ...row })), error })
      },
    }
    return q
  }
  const storage = {
    from: () => ({
      createSignedUrls: async paths => {
        db.signed.push(...paths)
        return { data: paths.map(path => ({ path, signedUrl: `https://signed.example/${path}` })), error: null }
      },
    }),
  }
  return { supabase: { from: query, storage } }
})

import AdminBot from './AdminBot'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const READY = 'Approve it and the phone makes it right away, with “Creep” by Radiohead from Instagram\'s music under the voice, then shares it on its day.'
const SWAPPED = 'Instagram\'s music doesn\'t have “Creep”, so this is now “Dreams” by Fleetwood Mac, another of the day before\'s songs. Approve it again and the phone makes it.'
const MADE = 'Made on the phone with “Creep” by Radiohead under the voice (in Reels drafts as 2026-11-24).'
const WAIT_SHARE = 'Waiting for the Mac to be free (unlocked and untouched) to share it.'
const SHARING = 'Sharing it from the phone now.'
const RETRY_SHARE = 'Couldn\'t share it from the phone just now. Trying again in 10 minutes.'
const DAY_PASSED = 'Its day passed before the phone could share it, and its caption calls the song yesterday\'s, so the bot won\'t post it now.'
const SHARE_UNSEEN = 'The phone tapped Share at 9:02 AM but Instagram doesn\'t show the post. Check @tempify.me before posting it yourself: it may be up, or still in Reels drafts as 2026-11-24.'
const NO_DRAFT = 'The phone couldn\'t make it after 3 tries (Instagram wouldn\'t open). Post it yourself or send it back.'
const NO_SONG = 'Instagram\'s music doesn\'t have “Creep”, and none of the day before\'s other songs can go on a card. Post it without the song, or send it back.'
const PUZZLES_CHANGED = 'The puzzles changed after this was made, and the bot couldn\'t make it again (no song left). Don\'t post it as it is.'
const CAPTION = 'Where did “Creep” by Radiohead peak on the Hot 100? Vote, then see the answer.'

const chartFact = more => ({
  id: 'c1', kind: 'post', title: 'Chart fact for Tue 11/24', body: CAPTION, place: 'Instagram',
  due_on: '2026-11-24', status: 'waiting', auto_post: true, bot_note: READY, ...more,
})

const handedBack = more => chartFact({ auto_post: false, bot_note: 'Three tries at the draft failed.', ...more })

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
const fire = el => el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
const text = () => container.textContent

async function click(label) {
  await act(async () => { fire(button(label)) })
}

async function openRow(day) {
  const row = [...container.querySelectorAll('button[aria-expanded]')].find(b => b.textContent.includes(day))
  await act(async () => { fire(row) })
}

async function type(selector, value) {
  const el = container.querySelector(selector)
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set
  await act(async () => {
    setter.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

// The page checking again, the way it does on coming back to it.
async function check() {
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'))
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

// At this time Eastern, on a day in November (when Eastern is UTC-5).
function at(day, hhmm) {
  vi.setSystemTime(new Date(`2026-11-${day}T${hhmm}:00-05:00`))
}

beforeEach(() => {
  vi.stubEnv('VITE_ADMIN_EMAIL', 'admin@example.com')
  vi.useFakeTimers({ toFake: ['Date'] })
  at('02', '10:00')
  db.fail = false
  db.noSettings = false
  db.native = false
  db.opened = []
  db.signed = []
  db.settings = [{ post_at: '09:00:00' }]
  db.updates = []
  db.log = [{ id: 1, at: '2026-11-24T14:00:00Z', summary: 'Wrote Hit or Miss for Tue 11/24', failed: false }]
  db.items = [
    { id: 'p1', kind: 'post', title: 'Show HN post', body: 'Write this in your own words.', place: 'Show HN', due_on: '2026-12-02', status: 'waiting' },
    { id: 'n1', kind: 'note', title: 'A word from the bot', body: 'The index was updated.', status: 'waiting' },
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
    expect(text()).toContain('To look at (2)')
    expect(text()).toContain('Show HN post')
    expect(text()).toContain('Sent back (1)')
    expect(text()).toContain('Reddit post 1')
    expect(text()).toContain('Your note: Lead with Creep')
    expect(text()).toContain('Wrote Hit or Miss for Tue 11/24')
  })

  it('says when the 7 AM run gets to what was sent back', async () => {
    await render()
    expect(text()).toContain('The 7 AM run makes these again')
    expect(text()).toContain('Back tomorrow after 7 AM')
  })

  it('answers a note', async () => {
    await render()
    await click('Looks good')
    expect(db.updates).toEqual([expect.objectContaining({ table: 'agent_items', id: 'n1', status: 'approved' })])
    expect(db.updates[0].decided_at).toBeTruthy()
    expect(text()).toContain('To look at (1)')
  })

  it('marks a post as posted, with its link', async () => {
    await render()
    await click('Posted')
    await type('input', 'https://instagram.com/p/abc')
    await click('Save')
    expect(db.updates).toEqual([expect.objectContaining({ id: 'p1', status: 'posted', link: 'https://instagram.com/p/abc', auto_post: false })])
  })

  it('needs a note to send something back', async () => {
    await render()
    await click('Send back')
    expect(button('Send back').disabled).toBe(true)
    await type('textarea', 'Use a song from the 90s')
    await click('Send back')
    expect(db.updates).toEqual([expect.objectContaining({ id: 'p1', status: 'sent_back', note: 'Use a song from the 90s' })])
    expect(text()).toContain('Your note: Use a song from the 90s')
  })
})

describe('games', () => {
  it('never asks about them, whatever state the bot left them in', async () => {
    db.items.push(
      { id: 'z1', kind: 'puzzle', title: 'Hit or Miss, Tue 11/24', body: 'Five songs', game_slug: 'hit-or-miss', puzzle_date: '2026-11-24', status: 'waiting' },
      { id: 'z2', kind: 'puzzle', title: 'Era, Tue 11/24', body: 'Five songs', game_slug: 'era', puzzle_date: '2026-11-24', status: 'approved' },
    )
    await render()
    expect(text()).toContain('To look at (2)')
    expect(text()).not.toContain('Hit or Miss, Tue 11/24')
    expect(text()).not.toContain('Era, Tue 11/24')
    expect(text()).not.toContain('1 card needs you')
  })

  it('still shows one that was already sent back', async () => {
    db.items.push({ id: 'z3', kind: 'puzzle', title: 'Era, Tue 11/24', body: '', status: 'sent_back', note: 'Fix the year' })
    await render()
    expect(text()).toContain('Era, Tue 11/24')
  })

  it('still lists them in what the bot did', async () => {
    db.items.push({ id: 'z1', kind: 'puzzle', title: 'Hit or Miss, Tue 11/24', status: 'waiting' })
    await render()
    expect(text()).toContain('Wrote Hit or Miss for Tue 11/24')
  })
})

describe('a chart fact to approve', () => {
  it('names the song, plays the Reel, and says it has no song yet', async () => {
    db.items = [chartFact({ images: ['posts/2026-11-24/reel.mp4', 'posts/2026-11-24/1.jpg'] })]
    await render()
    expect(text()).toContain('“Creep” by Radiohead')
    expect(container.querySelector('video').getAttribute('src')).toBe('https://signed.example/posts/2026-11-24/reel.mp4')
    expect(text()).toContain('No song here. The phone adds it.')
    expect(text()).toContain('Approve it and the phone makes the draft right away. It goes up on Tue Nov 24 at 9 AM.')
    expect(button('Posted')).toBeUndefined()
  })

  it('keeps the spare pictures behind a tap', async () => {
    db.items = [chartFact({ images: ['posts/2026-11-24/reel.mp4', 'posts/2026-11-24/1.jpg', 'posts/2026-11-24/2.jpg'] })]
    await render()
    expect(container.querySelector('img')).toBeNull()
    await click('Show the pictures (2)')
    expect(container.querySelectorAll('img').length).toBe(2)
  })

  it('hands it to the bot', async () => {
    db.items = [chartFact()]
    await render()
    await click('Approve to post')
    expect(db.updates).toEqual([expect.objectContaining({ id: 'c1', status: 'approved' })])
    expect(text()).toContain('The bot has these (1)')
    expect(text()).toContain('Tue Nov 24 Approved')
    expect(text()).toContain('To look at')
    expect(button('Approve to post')).toBeUndefined()
  })

  it('stops promising a time once the post\'s time has passed', async () => {
    at('24', '09:30')
    db.items = [chartFact()]
    await render()
    expect(text()).toContain('It goes up today, once the draft is made and the Mac is free.')
  })

  it('puts a card with a new song first, and asks for a new approval', async () => {
    db.items = [
      chartFact({ id: 'c0', title: 'Chart fact for Mon 11/23', due_on: '2026-11-23' }),
      chartFact({ bot_note: SWAPPED, body: 'Where did “Dreams” by Fleetwood Mac peak on the Hot 100?' }),
    ]
    await render()
    expect(text()).toContain('Song changed')
    expect(text()).toContain('Instagram\'s music doesn\'t have “Creep”, so the Reel was made again.')
    expect(text()).toContain('“Dreams” by Fleetwood Mac')
    expect(text().indexOf('Song changed')).toBeLessThan(text().indexOf('Chart fact for Mon 11/23'))
    expect(button('Approve again')).toBeTruthy()
    await click('Approve again')
    expect(db.updates).toEqual([expect.objectContaining({ id: 'c1', status: 'approved' })])
  })

  it('shows a line it doesn\'t know, as it is', async () => {
    db.items = [chartFact({ bot_note: 'Something new from the job.' })]
    await render()
    expect(text()).toContain('Something new from the job.')
    expect(button('Approve to post')).toBeTruthy()
  })
})

describe('the cards the bot has', () => {
  it('shows each as a short row with its stage and song', async () => {
    db.items = [chartFact({ status: 'approved', bot_note: MADE })]
    await render()
    expect(text()).toContain('The bot has these (1)')
    expect(text()).toContain('Tue Nov 24 Draft ready')
    expect(text()).toContain('“Creep” by Radiohead')
    expect(text()).toContain('9 AM')
    expect(button('Send back')).toBeUndefined()
  })

  it('only loads a Reel once its row is opened', async () => {
    db.items = [chartFact({ status: 'approved', bot_note: MADE, images: ['posts/2026-11-24/reel.mp4'] })]
    await render()
    expect(db.signed).toEqual([])
    expect(container.querySelector('video')).toBeNull()
    await openRow('Tue Nov 24')
    expect(db.signed).toEqual(['posts/2026-11-24/reel.mp4'])
    expect(container.querySelector('video')).toBeTruthy()
  })

  it('shows the stage and the bot\'s exact words when opened', async () => {
    db.items = [chartFact({ status: 'approved', bot_note: MADE })]
    await render()
    await openRow('Tue Nov 24')
    expect(text()).toContain('ApprovedDraftShareLive')
    expect(text()).toContain(`Bot: ${MADE}`)
    expect(container.querySelector('[aria-current="step"]').textContent).toBe('Share')
  })

  it('reads the waiting line as just approved, for the minute before the job sees it', async () => {
    db.items = [chartFact({ status: 'approved', bot_note: READY })]
    await render()
    expect(text()).toContain('Tue Nov 24 Approved')
    expect(text()).toContain('The phone starts on it within a minute.')
  })

  it('sends one back, with a note', async () => {
    db.items = [chartFact({ status: 'approved', bot_note: MADE })]
    await render()
    await openRow('Tue Nov 24')
    await click('Send back')
    await type('textarea', 'Say seventy with a full d')
    await click('Send back')
    expect(db.updates).toEqual([expect.objectContaining({ id: 'c1', status: 'sent_back', note: 'Say seventy with a full d' })])
    expect(text()).toContain('Your note: Say seventy with a full d')
  })

  it('warns before sending one back that would miss its day', async () => {
    at('24', '08:00')
    db.items = [chartFact({ status: 'approved', bot_note: MADE })]
    await render()
    await openRow('Tue Nov 24')
    await click('Send back')
    expect(text()).toContain("If you send this back, it won't go up. Only the 7 AM run makes a card again, and the next one comes after its day.")
  })

  it('warns on a card still waiting to be approved too, if it\'s due today', async () => {
    at('24', '08:00')
    db.items = [chartFact()]
    await render()
    await click('Send back')
    expect(text()).toContain("If you send this back, it won't go up.")
  })

  it('says a card due today can still come back before the 7 AM run', async () => {
    at('24', '06:30')
    db.items = [chartFact({ status: 'approved', bot_note: MADE })]
    await render()
    await openRow('Tue Nov 24')
    await click('Send back')
    expect(text()).toContain('The 7 AM run makes it again today. Approve it by 9 AM to keep it on time.')
    expect(text()).not.toContain("it won't go up")
  })

  it('offers Send back during the wait after a failed share', async () => {
    db.items = [chartFact({ status: 'approved', bot_note: RETRY_SHARE })]
    await render()
    await openRow('Tue Nov 24')
    await click('Send back')
    await type('textarea', 'Say seventy with a full d')
    await click('Send back')
    expect(db.updates).toEqual([expect.objectContaining({ id: 'c1', status: 'sent_back' })])
  })

  it('goes by status first when a card is sent back while the phone is making it', async () => {
    db.items = [chartFact({ status: 'sent_back', bot_note: MADE, note: 'Say seventy with a full d' })]
    await render()
    expect(text()).toContain('Sent back (1)')
    expect(text()).toContain('Your note: Say seventy with a full d')
    expect(text()).not.toContain('Draft ready')
    expect(text()).not.toContain('The bot has these')
  })

  it('offers no Send back while it\'s sharing', async () => {
    db.items = [chartFact({ status: 'approved', bot_note: SHARING })]
    await render()
    await openRow('Tue Nov 24')
    expect(button('Send back')).toBeUndefined()
    expect(text()).toContain("It may be going up now, so it can't be sent back.")
  })

  it('shows a line it doesn\'t know as it is, and offers no Send back', async () => {
    db.items = [chartFact({ status: 'approved', bot_note: 'Something new from the job.' })]
    await render()
    expect(text()).toContain('Something new from the job.')
    await openRow('Tue Nov 24')
    expect(button('Send back')).toBeUndefined()
    expect(text()).toContain("Send back is off because the page doesn't know this line yet.")
  })

  it('says how late it is and what to do when the Mac is in the way', async () => {
    at('24', '09:42')
    db.items = [chartFact({ status: 'approved', bot_note: WAIT_SHARE })]
    await render()
    expect(text()).toContain('Waiting on your Mac')
    expect(text()).toContain("Tue Nov 24 was due at 9 AM. It's 42 minutes late.")
    expect(text()).toContain('Unlock the Mac and leave it alone for 30 seconds. Keep the phone nearby and locked.')
    expect(text()).toContain('42 min late')
  })

  it('says the Mac may be off when a post\'s time passes and nothing moves', async () => {
    at('24', '09:30')
    db.items = [chartFact({ status: 'approved', bot_note: MADE })]
    await render()
    expect(text()).toContain("The bot hasn't started sharing Tue Nov 24")
    expect(text()).toContain('The Mac may be asleep or off.')
  })
})

describe('the cards that need Jett', () => {
  it('sets a handed-back card apart, with the bot\'s reason and what to do', async () => {
    db.items = [handedBack()]
    await render()
    expect(text()).toContain('1 card needs you')
    expect(text()).toContain('Needs you (1)')
    expect(text()).toContain('Handed back')
    expect(text()).toContain('Three tries at the draft failed.')
    expect(text()).toContain('Check Instagram first, since it may be up.')
    expect(text()).toContain('share the draft named 2026-11-24 from Reels drafts')
    expect(button('Posted')).toBeTruthy()
    expect(button('Approve to post')).toBeUndefined()
  })

  it('leaves Reddit and Show HN posts alone', async () => {
    await render()
    expect(text()).not.toContain('Needs you')
    expect(text()).not.toContain('Handed back')
  })

  it('takes Posted on a handed-back card, and lists it', async () => {
    db.items = [handedBack()]
    await render()
    await click('Posted')
    await type('input', 'https://instagram.com/p/abc')
    await click('Save')
    expect(db.updates).toEqual([expect.objectContaining({ id: 'c1', status: 'posted', link: 'https://instagram.com/p/abc' })])
    expect(text()).toContain('Recent posts')
    expect(text()).toContain('Open on Instagram')
    expect(text()).not.toContain('Needs you')
  })

  it('offers Send back while it can still make its day, and Skip it after', async () => {
    db.items = [handedBack()]
    await render()
    expect(button('Send back')).toBeTruthy()
    expect(button('Skip it')).toBeUndefined()
    act(() => root.unmount())
    container.remove()

    at('24', '10:00')
    await render()
    expect(button('Send back')).toBeUndefined()
    expect(button('Skip it')).toBeTruthy()
  })

  it('treats an unapproved chart fact whose day has passed the same way', async () => {
    at('25', '10:00')
    db.items = [chartFact()]
    await render()
    expect(text()).toContain('Its day passed')
    expect(text()).toContain("Its day has passed, so the bot won't post it.")
    expect(button('Approve to post')).toBeUndefined()
    expect(button('Posted')).toBeTruthy()
    expect(text()).not.toContain('Approve it and the phone makes it right away')
  })

  it('skips a dead card only after making sure, without giving it back to the bot', async () => {
    at('25', '10:00')
    db.items = [chartFact()]
    await render()
    await click('Skip it')
    expect(db.updates).toEqual([])
    expect(text()).toContain('Skip this one? It leaves this list and nothing goes up.')
    await click('Skip it')
    expect(db.updates).toEqual([expect.objectContaining({ id: 'c1', status: 'approved', auto_post: false })])
    expect(text()).not.toContain('Needs you')
    expect(text()).not.toContain('The bot has these')
    expect(text()).not.toContain('Recent posts')
  })

  it('gives each line its own to-do', async () => {
    db.items = [chartFact({ auto_post: false, bot_note: NO_DRAFT })]
    await render()
    expect(text()).toContain(NO_DRAFT)
    expect(text()).toContain('Send it back for the 7 AM run to make again, or post it yourself and tap Posted. There may be no finished draft.')
    expect(text()).not.toContain('Check @tempify.me first')
    expect(text()).not.toContain('Check Instagram')
  })

  it('tells Jett to check first only when a post may be up', async () => {
    db.items = [chartFact({ auto_post: false, bot_note: SHARE_UNSEEN })]
    await render()
    expect(text()).toContain('Check Instagram')
    expect(text()).toContain("Check @tempify.me first, since it may be up. If it is, tap Posted. If it isn't, share the draft named 2026-11-24")
    await click('Send back')
    expect(text()).toContain("The bot won't tap Share on this one again, so you'd still post it yourself.")
  })

  it('offers posting without the song when there\'s none to use', async () => {
    db.items = [chartFact({ auto_post: false, bot_note: NO_SONG, images: ['posts/2026-11-24/reel.mp4'] })]
    await render()
    expect(text()).toContain('or post it without the song and tap Posted.')
    expect(button('Posted')).toBeTruthy()
    expect(button('Show the Reel')).toBeTruthy()
    expect(button('Copy text')).toBeTruthy()
  })

  it('gives a card whose day passed nothing to post from, only Skip it', async () => {
    at('25', '09:00')
    db.items = [chartFact({ auto_post: false, bot_note: DAY_PASSED, images: ['posts/2026-11-24/reel.mp4'] })]
    await render()
    expect(text()).toContain(DAY_PASSED)
    expect(text()).toContain("Don't post it, since the caption would be wrong now")
    expect(button('Skip it')).toBeTruthy()
    for (const label of ['Posted', 'Send back', 'Show the Reel', 'Copy text']) expect(button(label)).toBeUndefined()
  })

  it('shows the puzzle line in note as the reason, never as Jett\'s note', async () => {
    db.items = [chartFact({ auto_post: false, bot_note: null, note: PUZZLES_CHANGED, images: ['posts/2026-11-24/reel.mp4'] })]
    await render()
    expect(text()).toContain('Needs you (1)')
    expect(text()).toContain("Don't post this")
    expect(text()).toContain(PUZZLES_CHANGED)
    expect(text()).toContain("Don't post it. Send it back for the 7 AM run to try again.")
    expect(text()).not.toContain('Your last note')
    expect(button('Approve to post')).toBeUndefined()
    for (const label of ['Posted', 'Show the Reel', 'Copy text']) expect(button(label)).toBeUndefined()
    expect(button('Send back')).toBeTruthy()
  })

  it('puts the puzzle line ahead of whatever bot_note still says', async () => {
    db.items = [chartFact({ auto_post: false, bot_note: MADE, note: PUZZLES_CHANGED })]
    await render()
    expect(text()).toContain(PUZZLES_CHANGED)
    expect(text()).not.toContain(MADE)
  })

  it('still shows Jett\'s own note on a handed-back card', async () => {
    db.items = [chartFact({ auto_post: false, bot_note: NO_DRAFT, note: 'Use a song from the 90s' })]
    await render()
    expect(text()).toContain('Your last note: Use a song from the 90s')
  })

  it('moves a card sent back too late to Needs you, where it can be cleared', async () => {
    at('24', '08:00')
    db.items = [chartFact({ status: 'approved', bot_note: MADE })]
    await render()
    await openRow('Tue Nov 24')
    await click('Send back')
    await type('textarea', 'The voice is wrong')
    await click('Send back')
    expect(text()).toContain('1 card needs you')
    expect(text()).toContain("Won't go up")
    expect(text()).toContain("It won't go up unless you post it yourself.")
    expect(text()).toContain('Your last note: The voice is wrong')
    expect(text()).not.toContain('Sent back (')
    expect(text()).not.toContain('Back tomorrow')
    await click('Skip it')
    await click('Skip it')
    expect(db.items[0]).toMatchObject({ status: 'approved', auto_post: false })
    expect(text()).not.toContain('Needs you')
  })

  it('keeps a card sent back the day before in Sent back', async () => {
    at('23', '20:00')
    db.items = [chartFact({ status: 'sent_back', bot_note: MADE, note: 'Fix it' })]
    await render()
    expect(text()).toContain('Sent back (1)')
    expect(text()).toContain('Back tomorrow after 7 AM')
    expect(text()).not.toContain('Needs you')
  })

  it('warns that a skipped card\'s draft stays on the phone', async () => {
    at('25', '10:00')
    db.items = [chartFact()]
    await render()
    await click('Skip it')
    expect(text()).toContain('Any draft stays in Reels drafts.')
  })

  // The bot's dashboard only logs "Jett posted" with auto_post off. These two
  // are the Posted buttons on rows that still have it on.
  it('turns auto_post off with Posted on a card sent back too late', async () => {
    at('24', '08:00')
    db.items = [chartFact({ status: 'sent_back', bot_note: MADE, note: 'The voice is wrong' })]
    await render()
    await click('Posted')
    await click('Save')
    expect(db.updates).toEqual([expect.objectContaining({ id: 'c1', status: 'posted', auto_post: false })])
  })

  it('turns auto_post off with Posted on a card whose day passed unapproved', async () => {
    at('25', '10:00')
    db.items = [chartFact()]
    await render()
    await click('Posted')
    await click('Save')
    expect(db.updates).toEqual([expect.objectContaining({ id: 'c1', status: 'posted', auto_post: false })])
  })

  it('leaves a card remade by hand to be approved, without its old hand-back line', async () => {
    db.items = [chartFact({ bot_note: NO_DRAFT })]
    await render()
    expect(text()).not.toContain('Needs you')
    expect(text()).not.toContain(NO_DRAFT)
    expect(button('Approve to post')).toBeTruthy()
    expect(button('Posted')).toBeUndefined()
    expect(text()).toContain('“Creep” by Radiohead')
  })

  it('reads that card as approved once Jett approves it, until the job writes a new line', async () => {
    db.items = [chartFact({ bot_note: SHARE_UNSEEN })]
    await render()
    await click('Approve to post')
    expect(text()).toContain('Tue Nov 24 Approved')
    expect(text()).not.toContain(SHARE_UNSEEN)
    await openRow('Tue Nov 24')
    expect(text()).not.toContain(SHARE_UNSEEN)
    expect(button('Send back')).toBeTruthy()
  })

  it('loads a handed-back card\'s Reel only when asked', async () => {
    db.items = [handedBack({ images: ['posts/2026-11-24/reel.mp4'] })]
    await render()
    expect(db.signed).toEqual([])
    await click('Show the Reel')
    expect(container.querySelector('video')).toBeTruthy()
  })
})

describe('the page staying up to date', () => {
  it('picks up what the job changed', async () => {
    db.items = [chartFact({ status: 'approved', bot_note: MADE })]
    await render()
    expect(text()).toContain('Draft ready')
    db.items[0].bot_note = SHARING
    await check()
    expect(text()).toContain('Sharing now')
    expect(text()).not.toContain('Draft ready')
  })

  it('checks every 30 seconds', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    db.items = [chartFact({ status: 'approved', bot_note: MADE })]
    await render()
    db.items[0].bot_note = SHARING
    await act(async () => {
      vi.advanceTimersByTime(29000)
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(text()).toContain('Draft ready')
    await act(async () => {
      vi.advanceTimersByTime(1000)
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(text()).toContain('Sharing now')
  })

  it('stops checking while the page is out of sight', async () => {
    db.items = [chartFact({ status: 'approved', bot_note: MADE })]
    await render()
    db.items[0].bot_note = SHARING
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    await check()
    expect(text()).toContain('Draft ready')
    hidden.mockRestore()
    await check()
    expect(text()).toContain('Sharing now')
  })

  it('keeps a half-written note when the job moves the card on', async () => {
    db.items = [chartFact({ status: 'approved', bot_note: MADE })]
    await render()
    await openRow('Tue Nov 24')
    await click('Send back')
    await type('textarea', 'Say seventy with a full d')
    db.items[0].bot_note = WAIT_SHARE
    await check()
    expect(container.querySelector('textarea').value).toBe('Say seventy with a full d')
    await click('Send back')
    expect(db.updates).toEqual([expect.objectContaining({ id: 'c1', status: 'sent_back' })])
  })

  it('keeps a Reel playing through a check that only moved the stage', async () => {
    db.items = [chartFact({ status: 'approved', bot_note: MADE, images: ['posts/2026-11-24/reel.mp4'] })]
    await render()
    await openRow('Tue Nov 24')
    const video = container.querySelector('video')
    db.items[0].bot_note = WAIT_SHARE
    await check()
    expect(container.querySelector('video')).toBe(video)
    expect(db.signed.length).toBe(1)
  })

  it('gets a new Reel when a card is made again under the same path', async () => {
    db.items = [chartFact({ images: ['posts/2026-11-24/reel.mp4'] })]
    await render()
    expect(db.signed.length).toBe(1)
    db.items[0].body = 'Where did “Dreams” by Fleetwood Mac peak on the Hot 100?'
    db.items[0].bot_note = SWAPPED
    await check()
    expect(db.signed.length).toBe(2)
  })

  it('closes the Send back box if the card starts sharing', async () => {
    db.items = [chartFact({ status: 'approved', bot_note: MADE })]
    await render()
    await openRow('Tue Nov 24')
    await click('Send back')
    db.items[0].bot_note = SHARING
    await check()
    expect(container.querySelector('textarea')).toBeNull()
    expect(text()).toContain("It may be going up now, so it can't be sent back.")
  })

  it('keeps the list and says so when a check fails', async () => {
    db.items = [chartFact({ status: 'approved', bot_note: MADE })]
    await render()
    db.fail = true
    await check()
    expect(text()).toContain('Draft ready')
    expect(text()).toContain("Couldn't check just now")
    expect(text()).not.toContain('migration 015')
    db.fail = false
    await check()
    expect(text()).not.toContain("Couldn't check just now")
  })

  it('says when it last checked', async () => {
    await render()
    expect(text()).toContain('Checked 10:00 AM')
  })
})

describe('an answer on a card that has changed', () => {
  it('won\'t approve a Reel Jett hasn\'t seen, and shows him the new one', async () => {
    db.items = [chartFact()]
    await render()
    db.items[0].bot_note = SWAPPED
    db.items[0].body = 'Where did “Dreams” by Fleetwood Mac peak on the Hot 100?'
    await click('Approve to post')
    expect(db.updates).toEqual([])
    expect(db.items[0].status).toBe('waiting')
    expect(text()).toContain("This card just changed, so that didn't save. Look it over and try again.")
    expect(text()).toContain('“Dreams” by Fleetwood Mac')
    expect(button('Approve again')).toBeTruthy()
  })

  it('won\'t send back a card that has started sharing', async () => {
    db.items = [chartFact({ status: 'approved', bot_note: MADE })]
    await render()
    await openRow('Tue Nov 24')
    await click('Send back')
    await type('textarea', 'Say seventy with a full d')
    db.items[0].bot_note = SHARING
    await click('Send back')
    expect(db.updates).toEqual([])
    expect(db.items[0].status).toBe('approved')
    expect(text()).toContain("It may be going up now, so it can't be sent back.")
  })

  it('won\'t undo a card that has already gone up', async () => {
    db.items = [chartFact({ status: 'approved', bot_note: MADE })]
    await render()
    await openRow('Tue Nov 24')
    await click('Send back')
    await type('textarea', 'Too late')
    db.items[0].status = 'posted'
    db.items[0].link = 'https://instagram.com/p/abc'
    await click('Send back')
    expect(db.updates).toEqual([])
    expect(db.items[0].status).toBe('posted')
    expect(text()).toContain('Recent posts')
  })

  it('still saves a card with no line from the bot', async () => {
    await render()
    await click('Looks good')
    expect(db.updates).toEqual([expect.objectContaining({ id: 'n1', status: 'approved' })])
  })

  it('says so when the connection drops', async () => {
    db.items = [chartFact()]
    await render()
    db.fail = true
    await click('Approve to post')
    expect(text()).toContain("That didn't save. Check your connection and try again.")
  })
})

// jobs/phone.py treats a card Jett answered again, by a changed decided_at, as
// needing a new draft, and checks it again right before Share. So every answer
// has to write it.
describe('every answer writes decided_at', () => {
  const answers = [
    ['Approve to post', () => [chartFact()], async () => { await click('Approve to post') }],
    ['Approve again', () => [chartFact({ bot_note: 'Instagram\'s music doesn\'t have “Creep”, so this is now “Dreams” by Fleetwood Mac, another of the day before\'s songs. Approve it again and the phone makes it.' })], async () => { await click('Approve again') }],
    ['Looks good', () => [{ id: 'n1', kind: 'note', title: 'A word', body: 'x', status: 'waiting' }], async () => { await click('Looks good') }],
    ['Posted', () => [chartFact({ auto_post: false, bot_note: NO_DRAFT })], async () => { await click('Posted'); await click('Save') }],
    ['Send back on a card to approve', () => [chartFact()], async () => {
      await click('Send back'); await type('textarea', 'Fix it'); await click('Send back')
    }],
    ['Send back on a card the bot has', () => [chartFact({ status: 'approved', bot_note: MADE })], async () => {
      await openRow('Tue Nov 24'); await click('Send back'); await type('textarea', 'Fix it'); await click('Send back')
    }],
    ['Send back on a handed-back card', () => [chartFact({ auto_post: false, bot_note: NO_DRAFT })], async () => {
      await click('Send back'); await type('textarea', 'Fix it'); await click('Send back')
    }],
  ]

  it.each(answers)('%s', async (_, rows, answer) => {
    db.items = rows()
    await render()
    await answer()
    expect(db.updates).toHaveLength(1)
    expect(db.updates[0].decided_at).toBe(new Date().toISOString())
  })

  it('Skip it', async () => {
    at('25', '10:00')
    db.items = [chartFact()]
    await render()
    await click('Skip it')
    await click('Skip it')
    expect(db.updates).toHaveLength(1)
    expect(db.updates[0].decided_at).toBe(new Date().toISOString())
  })

  it('changes it when a card is answered again', async () => {
    db.items = [chartFact()]
    await render()
    await click('Approve to post')
    const first = db.items[0].decided_at
    at('02', '10:05')
    await openRow('Tue Nov 24')
    await click('Send back')
    await type('textarea', 'Fix it')
    await click('Send back')
    expect(db.items[0].decided_at).not.toBe(first)
  })
})

describe('recent posts', () => {
  it('lists what went up, with the song and a link', async () => {
    db.items = [chartFact({
      status: 'posted', link: 'https://instagram.com/reel/abc', bot_note: 'Shared from the phone with “Creep” by Radiohead.', updated_at: '2026-11-24T14:01:00Z',
    })]
    await render()
    expect(text()).toContain('Recent posts')
    expect(text()).toContain('Tue Nov 24')
    expect(text()).toContain('“Creep” by Radiohead')
    expect(container.querySelector('a[href="https://instagram.com/reel/abc"]').textContent).toBe('Open on Instagram')
  })

  it('lists one Jett posted himself, by its title', async () => {
    db.items = [{ id: 'r1', kind: 'post', title: 'Reddit post 1', body: 'Facts', status: 'posted', link: 'https://reddit.com/r/abc', updated_at: '2026-11-24T14:01:00Z' }]
    await render()
    expect(text()).toContain('Reddit post 1')
  })

  it('makes a link only of a real web address', async () => {
    db.items = [chartFact({ status: 'posted', link: 'javascript:alert(1)', updated_at: '2026-11-24T14:01:00Z' })]
    await render()
    expect(container.querySelector('a[href^="javascript"]')).toBeNull()
    expect(text()).toContain('No link saved')
  })

  it('opens the link from the iPhone app with the app\'s own browser', async () => {
    db.native = true
    db.items = [chartFact({ status: 'posted', link: 'https://instagram.com/reel/abc', updated_at: '2026-11-24T14:01:00Z' })]
    await render()
    await act(async () => { fire(container.querySelector('a[href="https://instagram.com/reel/abc"]')) })
    expect(db.opened).toEqual(['https://instagram.com/reel/abc'])
  })
})

describe('the posting time', () => {
  it('follows the time set in Admin, and saves a new one', async () => {
    db.settings = [{ post_at: '07:30:00' }]
    db.items = [chartFact({ status: 'approved', bot_note: MADE })]
    await render()
    expect(text()).toContain('Next up: Tue Nov 24 at 7:30 AM')
    expect(container.querySelector('input[type="time"]').value).toBe('07:30')
    await type('input[type="time"]', '12:15')
    await click('Save time')
    expect(db.updates).toEqual([expect.objectContaining({ table: 'agent_settings', id: true, post_at: '12:15' })])
    expect(text()).toContain('Next up: Tue Nov 24 at 12:15 PM')
  })

  it('says a new time counts for anything not shared yet', async () => {
    await render()
    expect(text()).toContain('A new time counts for anything not shared yet.')
  })

  it('keeps 9 AM and says why before migration 017 has run', async () => {
    db.noSettings = true
    await render()
    expect(container.querySelector('input[type="time"]')).toBeNull()
    expect(text()).toContain('The bot posts at 9 AM Eastern for now.')
    expect(text()).toContain('To look at (2)')
  })

  it('says what to do before migration 015 has run', async () => {
    db.fail = true
    await render()
    expect(text()).toContain('It starts once migration 015 has run')
  })
})
