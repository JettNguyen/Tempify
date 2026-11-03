import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  asksJett, backWhen, draftName, fmtClock, fmtLate, goesUpWhen, handBackOf, isHandedBack, isSentBackTooLate,
  isUnapprovedPastDay, jettsNote, lineKind, missesDay, needsJett, nextRunDay, rowWhen, sendBackWarning,
  songOf, stageOf, summarize, swappedFrom,
} from './botStage'

const READY = 'Approve it and the phone makes it right away, with “Creep” by Radiohead from Instagram\'s music under the voice, then shares it on its day.'
const SWAPPED = 'Instagram\'s music doesn\'t have “Creep”, so this is now “Dreams” by Fleetwood Mac, another of the day before\'s songs. Approve it again and the phone makes it.'
const WAIT_MAKE = 'Waiting for the Mac to be free (unlocked and untouched) to make it on the phone.'
const IN_LINE = 'In line for the phone, after the one before it.'
const MAKING = 'Making it on the phone now.'
const RETRY_MAKE = 'Couldn\'t make it on the phone just now. Trying again in 10 minutes.'
const MADE = 'Made on the phone with “Creep” by Radiohead under the voice (in Reels drafts as 2026-11-11).'
const WAIT_SHARE = 'Waiting for the Mac to be free (unlocked and untouched) to share it.'
const SHARING = 'Sharing it from the phone now.'
const RETRY_SHARE = 'Couldn\'t share it from the phone just now. Trying again in 10 minutes.'
const SHARED = 'Shared from the phone with “Creep” by Radiohead.'

// The seven lines that hand a card back, word for word from the note on the
// main Mac's check of jobs/phone.py, 11/3/2026. The seventh is in note.
const NO_DRAFT = 'The phone couldn\'t make it after 3 tries (Instagram wouldn\'t open). Post it yourself or send it back.'
const DAY_PASSED = 'Its day passed before the phone could share it, and its caption calls the song yesterday\'s, so the bot won\'t post it now.'
const SHARE_UNSEEN = 'The phone tapped Share at 9:02 AM but Instagram doesn\'t show the post. Check @tempify.me before posting it yourself: it may be up, or still in Reels drafts as 2026-11-11.'
const NO_SONG = 'Instagram\'s music doesn\'t have “Creep”, and none of the day before\'s other songs can go on a card. Post it without the song, or send it back.'
const NO_REMAKE = 'Instagram\'s music doesn\'t have “Creep”, and the bot couldn\'t make the card again with another song (the render stopped).'
const SHARE_AGAIN = 'The phone already tapped Share on this one and Instagram didn\'t show the post, so the bot won\'t tap it again. Check @tempify.me, then post it yourself if it isn\'t up.'
const PUZZLES_CHANGED = 'The puzzles changed after this was made, and the bot couldn\'t make it again (no song left). Don\'t post it as it is.'

const CAPTION = 'Where did “Creep” by Radiohead peak on the Hot 100? Vote, then see the answer.'

// Wed 11/11, at this time Eastern (the day is in EST).
function at(hhmm) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`2026-11-11T${hhmm}:00-05:00`))
}

const card = (bot_note, more = {}) => ({
  id: 'c', kind: 'post', place: 'Instagram', title: 'Chart fact for Wed 11/11', due_on: '2026-11-11',
  status: 'approved', auto_post: true, body: CAPTION, bot_note, ...more,
})

afterEach(() => vi.useRealTimers())

describe('reading the job\'s lines', () => {
  it.each([
    [READY, 'ready'], [SWAPPED, 'swapped'], [WAIT_MAKE, 'wait-make'], [IN_LINE, 'in-line'], [MAKING, 'making'],
    [RETRY_MAKE, 'retry-make'], [MADE, 'made'], [WAIT_SHARE, 'wait-share'], [SHARING, 'sharing'],
    [RETRY_SHARE, 'retry-share'], [SHARED, 'shared'],
  ])('knows %s', (line, kind) => {
    expect(lineKind(line)).toBe(kind)
  })

  it('doesn\'t mistake a hand-back about the music for a swapped song', () => {
    expect(lineKind(NO_SONG)).toBe('handed-back')
    expect(lineKind(NO_REMAKE)).toBe('handed-back')
    expect(swappedFrom({ bot_note: NO_SONG })).toBeNull()
  })

  it('knows every hand-back line in bot_note', () => {
    for (const line of [NO_DRAFT, DAY_PASSED, SHARE_UNSEEN, NO_SONG, NO_REMAKE, SHARE_AGAIN]) {
      expect(lineKind(line)).toBe('handed-back')
    }
  })

  it('takes either kind of apostrophe', () => {
    expect(lineKind(SWAPPED.replaceAll("'", '’'))).toBe('swapped')
    expect(lineKind(RETRY_SHARE.replaceAll("'", '’'))).toBe('retry-share')
  })

  it('calls any other line unknown and no line nothing', () => {
    expect(lineKind('Something new from the job.')).toBe('unknown')
    expect(lineKind(null)).toBeNull()
  })
})

describe('the card\'s song', () => {
  it('reads it from each line that names it', () => {
    expect(songOf({ bot_note: READY })).toBe('“Creep” by Radiohead')
    expect(songOf({ bot_note: SWAPPED })).toBe('“Dreams” by Fleetwood Mac')
    expect(songOf({ bot_note: MADE })).toBe('“Creep” by Radiohead')
    expect(songOf({ bot_note: SHARED })).toBe('“Creep” by Radiohead')
  })

  it('reads it from the caption when the line doesn\'t name it', () => {
    expect(songOf({ bot_note: WAIT_MAKE, body: CAPTION })).toBe('“Creep” by Radiohead')
    expect(songOf({ body: CAPTION })).toBe('“Creep” by Radiohead')
  })

  it('keeps periods and quote marks that belong to the names', () => {
    expect(songOf({ bot_note: 'Made on the phone with “Mr. Brightside” by The Killers under the voice (in Reels drafts as 2026-11-11).' }))
      .toBe('“Mr. Brightside” by The Killers')
    expect(songOf({ bot_note: 'Shared from the phone with “Still D.R.E.” by Dr. Dre.' })).toBe('“Still D.R.E.” by Dr. Dre')
    expect(songOf({ bot_note: 'Made on the phone with “Thriller 7"” by Michael Jackson under the voice (in Reels drafts as 2026-11-11).' }))
      .toBe('“Thriller 7"” by Michael Jackson')
  })

  it('has none for a card that doesn\'t say', () => {
    expect(songOf({ body: 'Lead with Creep' })).toBeNull()
  })

  it('finds the song a card lost, and the draft\'s name', () => {
    expect(swappedFrom({ bot_note: SWAPPED })).toBe('Creep')
    expect(swappedFrom({ bot_note: READY })).toBeNull()
    expect(draftName({ bot_note: MADE, due_on: '2026-11-12' })).toBe('2026-11-11')
    expect(draftName({ bot_note: 'Three tries failed.', due_on: '2026-11-12' })).toBe('2026-11-12')
  })
})

describe('where a card with the bot has got to', () => {
  it('treats the waiting lines as just approved, for the minute before the job sees it', () => {
    at('08:00')
    expect(stageOf(card(READY), '09:00')).toMatchObject({ key: 'picking-up', label: 'Approved', sendBack: true })
    expect(stageOf(card(SWAPPED), '09:00')).toMatchObject({ key: 'picking-up', label: 'Approved' })
  })

  it('gives each line its label and step', () => {
    at('08:00')
    const cases = [
      [IN_LINE, 'In line', 1], [WAIT_MAKE, 'Waiting on your Mac', 1], [MAKING, 'Making the draft', 1],
      [RETRY_MAKE, 'Trying again in 10 minutes', 1], [MADE, 'Draft ready', 2],
      [WAIT_SHARE, 'Waiting on your Mac', 2], [RETRY_SHARE, 'Trying again in 10 minutes', 2], [SHARING, 'Sharing now', 2],
    ]
    for (const [line, label, step] of cases) expect(stageOf(card(line), '09:00')).toMatchObject({ label, step })
  })

  it('takes Send back away only once it can no longer stop the post', () => {
    at('09:00')
    expect(stageOf(card(SHARING), '09:00').sendBack).toBe(false)
    for (const line of [READY, WAIT_MAKE, IN_LINE, MAKING, RETRY_MAKE, MADE, WAIT_SHARE, RETRY_SHARE]) {
      expect(stageOf(card(line), '09:00').sendBack).toBe(true)
    }
  })

  it('goes by status and auto_post when a card remade by hand still has its hand-back line', () => {
    at('08:00')
    for (const line of [NO_DRAFT, SHARE_UNSEEN, NO_SONG]) {
      expect(stageOf(card(line), '09:00')).toMatchObject({ key: 'picking-up', label: 'Approved', step: 1, sendBack: true })
    }
  })

  it('shows a line it doesn\'t know as it is, without Send back', () => {
    at('08:00')
    expect(stageOf(card('Something new from the job.'), '09:00'))
      .toMatchObject({ key: 'unknown', label: 'Something new from the job.', step: null, sendBack: false })
  })

  it('counts how late a post is on its own day only', () => {
    at('09:42')
    expect(stageOf(card(WAIT_SHARE), '09:00').late).toBe(42)
    expect(stageOf(card(WAIT_SHARE, { due_on: '2026-11-12' }), '09:00').late).toBe(0)
    at('08:30')
    expect(stageOf(card(WAIT_SHARE), '09:00').late).toBe(0)
  })

  it('follows the posting time', () => {
    at('09:42')
    expect(stageOf(card(WAIT_SHARE), '09:30').late).toBe(12)
    expect(stageOf(card(WAIT_SHARE), '10:00').late).toBe(0)
  })

  it('says the row\'s time, or how late it is when it\'s stuck', () => {
    at('09:42')
    const stuck = card(WAIT_SHARE)
    expect(rowWhen(stuck, stageOf(stuck, '09:00'), '09:00')).toBe('42 min late')
    const sharing = card(SHARING)
    expect(rowWhen(sharing, stageOf(sharing, '09:00'), '09:00')).toBe('Today 9 AM')
    const later = card(MADE, { due_on: '2026-11-12' })
    expect(rowWhen(later, stageOf(later, '09:00'), '09:00')).toBe('9 AM')
    at('10:05')
    expect(rowWhen(stuck, stageOf(stuck, '09:00'), '09:00')).toBe('1 hr 5 min late')
  })
})

describe('a job that has stopped', () => {
  it('leaves a draft alone for a few minutes past the time, then says so', () => {
    at('09:09')
    expect(stageOf(card(MADE), '09:00').stall).toBeUndefined()
    at('09:10')
    expect(stageOf(card(MADE), '09:00')).toMatchObject({ label: "Hasn't started sharing", stuck: true })
  })

  it('says when an approval hasn\'t been picked up', () => {
    at('08:00')
    expect(stageOf(card(READY, { decided_at: '2026-11-11T12:55:00Z' }), '09:00').stall).toBeUndefined()
    expect(stageOf(card(READY, { decided_at: '2026-11-11T12:45:00Z' }), '09:00')).toMatchObject({ label: 'Not picked up yet' })
  })

  it('says when an approved card\'s day has passed', () => {
    at('08:00')
    expect(stageOf(card(MADE, { due_on: '2026-11-10' }), '09:00')).toMatchObject({ label: 'Its day passed' })
  })

  it('doesn\'t call a card stopped while it\'s sharing', () => {
    at('09:40')
    expect(stageOf(card(SHARING), '09:00').stall).toBeUndefined()
  })
})

describe('sending a card back', () => {
  it('sees the morning run coming today until 7 AM, then tomorrow', () => {
    at('06:59')
    expect(nextRunDay()).toBe('2026-11-11')
    at('07:00')
    expect(nextRunDay()).toBe('2026-11-12')
  })

  it('crosses the end of a month', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-30T15:00:00Z'))
    expect(nextRunDay()).toBe('2026-12-01')
  })

  it('warns that a card due today won\'t go up once the day\'s run has been', () => {
    at('07:00')
    expect(missesDay(card(MADE))).toBe(true)
    expect(sendBackWarning(card(MADE), '09:00')).toBe("If you send this back, it won't go up. Only the 7 AM run makes a card again, and the next one comes after its day.")
    at('16:00')
    expect(sendBackWarning(card(MADE), '09:00')).toContain("it won't go up")
  })

  it('says a card due today can still come back before the day\'s run', () => {
    at('06:30')
    expect(missesDay(card(MADE))).toBe(false)
    expect(sendBackWarning(card(MADE), '09:00')).toBe('The 7 AM run makes it again today. Approve it by 9 AM to keep it on time.')
  })

  it('warns that a card remade on its own day has to be approved quickly', () => {
    at('08:00')
    expect(sendBackWarning(card(MADE, { due_on: '2026-11-12' }), '09:00')).toBe('The 7 AM run makes it again on its day. Approve it by 9 AM to keep it on time.')
  })

  it('says nothing when there\'s plenty of time, or for a post with no day', () => {
    at('08:00')
    expect(sendBackWarning(card(MADE, { due_on: '2026-11-14' }), '09:00')).toBeNull()
    expect(sendBackWarning({ kind: 'post', title: 'Reddit post' }, '09:00')).toBeNull()
  })

  it('leaves posts Jett puts up himself out of it, since the rule is about chart facts', () => {
    at('08:00')
    expect(sendBackWarning({ kind: 'post', place: 'Reddit r/WebGames', due_on: '2026-11-11', status: 'waiting' }, '09:00')).toBeNull()
    expect(isSentBackTooLate({ kind: 'post', place: 'Reddit r/WebGames', due_on: '2026-11-11', status: 'sent_back' })).toBe(false)
  })

  it('warns that a card the phone already tapped Share on won\'t be tapped again', () => {
    at('08:00')
    const later = { status: 'waiting', auto_post: false, due_on: '2026-11-14' }
    expect(sendBackWarning(card(SHARE_UNSEEN, later), '09:00')).toBe("The bot won't tap Share on this one again, so you'd still post it yourself.")
    expect(sendBackWarning(card(SHARE_AGAIN, later), '09:00')).toBe("The bot won't tap Share on this one again, so you'd still post it yourself.")
  })

  it('says when a card comes back', () => {
    at('06:00')
    expect(backWhen()).toBe('Back today after 7 AM')
    at('08:00')
    expect(backWhen()).toBe('Back tomorrow after 7 AM')
  })

  it('spots a card sent back too late to come back at all', () => {
    at('08:00')
    expect(isSentBackTooLate(card(MADE, { status: 'sent_back' }))).toBe(true)
    expect(needsJett(card(MADE, { status: 'sent_back' }))).toBe(true)
    expect(isSentBackTooLate(card(MADE, { status: 'sent_back', due_on: '2026-11-12' }))).toBe(false)
    expect(isSentBackTooLate(card(MADE))).toBe(false)
    at('06:00')
    expect(isSentBackTooLate(card(MADE, { status: 'sent_back' }))).toBe(false)
  })
})

describe('what needs Jett', () => {
  it('never asks about a game, and always about a post', () => {
    expect(asksJett({ kind: 'puzzle', status: 'waiting' })).toBe(false)
    expect(asksJett({ kind: 'post', status: 'waiting' })).toBe(true)
    expect(asksJett({ kind: 'note', status: 'waiting' })).toBe(true)
    expect(asksJett({ kind: 'post', status: 'approved' })).toBe(false)
  })

  it('can tell a handed-back card from a post Jett always puts up himself', () => {
    const back = card('Three tries failed.', { status: 'waiting', auto_post: false })
    expect(isHandedBack(back)).toBe(true)
    expect(isHandedBack({ kind: 'post', status: 'waiting', auto_post: false, place: 'Reddit r/WebGames', bot_note: null })).toBe(false)
    expect(isHandedBack({ kind: 'post', status: 'waiting', auto_post: false, place: 'Instagram', bot_note: null })).toBe(false)
    expect(isHandedBack(card(MADE, { status: 'waiting' }))).toBe(false)
  })

  it('spots a chart fact whose day passed before it was approved', () => {
    at('08:00')
    expect(isUnapprovedPastDay(card(READY, { status: 'waiting', due_on: '2026-11-10' }))).toBe(true)
    expect(isUnapprovedPastDay(card(READY, { status: 'waiting' }))).toBe(false)
  })
})

describe('a card handed back to Jett', () => {
  const back = (line, more = {}) => card(line, { status: 'waiting', auto_post: false, due_on: '2026-11-14', ...more })

  it('reads all seven lines', () => {
    at('08:00')
    expect(handBackOf(back(NO_DRAFT)).kind).toBe('no-draft')
    expect(handBackOf(back(DAY_PASSED)).kind).toBe('day-passed')
    expect(handBackOf(back(SHARE_UNSEEN)).kind).toBe('share-unseen')
    expect(handBackOf(back(NO_SONG)).kind).toBe('no-song')
    expect(handBackOf(back(NO_REMAKE)).kind).toBe('no-remake')
    expect(handBackOf(back(SHARE_AGAIN)).kind).toBe('share-again')
    expect(handBackOf(back(null, { note: PUZZLES_CHANGED })).kind).toBe('puzzles-changed')
  })

  it('shows each reason as the job wrote it', () => {
    at('08:00')
    for (const line of [NO_DRAFT, DAY_PASSED, SHARE_UNSEEN, NO_SONG, NO_REMAKE, SHARE_AGAIN]) {
      expect(handBackOf(back(line)).reason).toBe(line)
    }
  })

  it('takes a card that can\'t make it after 3 tries: send it back, or post by hand', () => {
    at('08:00')
    expect(handBackOf(back(NO_DRAFT))).toMatchObject({
      pill: 'Handed back', posted: true, back: true, skip: false, media: true,
      todo: 'Send it back for the 7 AM run to make again, or post it yourself and tap Posted. There may be no finished draft.',
    })
    expect(handBackOf(back(NO_DRAFT, { due_on: '2026-11-11' }))).toMatchObject({
      back: false, skip: true, todo: 'Post it yourself and tap Posted, or skip it. There may be no finished draft.',
    })
  })

  it('says not to post a card whose day passed, and offers only Skip it', () => {
    at('08:00')
    expect(handBackOf(back(DAY_PASSED, { due_on: '2026-11-10' }))).toMatchObject({
      pill: 'Its day passed', posted: false, back: false, skip: true, media: false,
      todo: "Nothing to do but skip it. Don't post it, since the caption would be wrong now, and sending it back won't help.",
    })
  })

  it('offers only Skip it on that line even if the day is still ahead', () => {
    at('08:00')
    expect(handBackOf(back(DAY_PASSED))).toMatchObject({ back: false, skip: true, posted: false })
  })

  it('sends lines 3 and 6 to Instagram first, and only those', () => {
    at('08:00')
    const check = 'Check @tempify.me first, since it may be up. If it is, tap Posted.'
    expect(handBackOf(back(SHARE_UNSEEN)).todo).toBe(`${check} If it isn't, share the draft named 2026-11-11 from Reels drafts on the phone if it's there, then tap Posted.`)
    expect(handBackOf(back(SHARE_AGAIN)).todo).toBe(`${check} If it isn't, share the draft named 2026-11-14 from Reels drafts on the phone if it's there, then tap Posted.`)
    expect(handBackOf(back(SHARE_UNSEEN)).pill).toBe('Check Instagram')
    expect(handBackOf(back(SHARE_AGAIN)).pill).toBe('Check Instagram')
    for (const line of [NO_DRAFT, DAY_PASSED, NO_SONG, NO_REMAKE]) {
      expect(handBackOf(back(line)).todo).not.toContain('tempify.me')
      expect(handBackOf(back(line)).todo).not.toMatch(/check/i)
    }
  })

  it('stops suggesting the draft once the day has passed', () => {
    at('08:00')
    expect(handBackOf(back(SHARE_UNSEEN, { due_on: '2026-11-10' })).todo).toBe("Check @tempify.me first, since it may be up. If it is, tap Posted. If it isn't, skip it, since its day has passed.")
  })

  it('offers posting without the song on lines 4 and 5', () => {
    at('08:00')
    for (const line of [NO_SONG, NO_REMAKE]) {
      expect(handBackOf(back(line)).todo).toBe('Send it back for the 7 AM run to try again, or post it without the song and tap Posted.')
      expect(handBackOf(back(line, { due_on: '2026-11-11' })).todo).toBe('Post it without the song and tap Posted, or skip it.')
    }
  })

  it('says not to post a card the puzzles moved past, whatever bot_note still says', () => {
    at('08:00')
    expect(handBackOf(back(MADE, { note: PUZZLES_CHANGED }))).toMatchObject({
      pill: "Don't post this", reason: PUZZLES_CHANGED, posted: false, back: true, media: false,
      todo: "Don't post it. Send it back for the 7 AM run to try again.",
    })
    expect(handBackOf(back(null, { note: PUZZLES_CHANGED, due_on: '2026-11-11' }))).toMatchObject({
      back: false, skip: true, todo: "Don't post it. Skip it to clear it.",
    })
  })

  it('counts that one as handed back with no bot_note at all', () => {
    expect(isHandedBack(back(null, { note: PUZZLES_CHANGED }))).toBe(true)
  })

  it('never calls the puzzle line Jett\'s own note', () => {
    expect(jettsNote({ note: PUZZLES_CHANGED })).toBeNull()
    expect(jettsNote({ note: 'Say seventy with a full d' })).toBe('Say seventy with a full d')
  })

  it('falls back to a to-do that fits any line, for one it doesn\'t know', () => {
    at('08:00')
    expect(handBackOf(back('Something new from the job.'))).toMatchObject({
      kind: 'unknown', pill: 'Handed back', reason: 'Something new from the job.', posted: true, back: true,
    })
    expect(handBackOf(back('Something new from the job.')).todo).toContain('Check Instagram first')
  })

  it('says a card sent back too late won\'t go up unless Jett posts it', () => {
    at('08:00')
    expect(handBackOf(card(MADE, { status: 'sent_back' }))).toMatchObject({
      pill: "Won't go up", posted: true, back: false, skip: true,
      reason: "You sent this back after the 7 AM run on its day, so the bot won't make it again.",
      todo: "It won't go up unless you post it yourself. If you do, tap Posted. If not, skip it.",
    })
  })
})

describe('when a card goes up', () => {
  it('names the day, today, or once the phone is done', () => {
    at('08:00')
    expect(goesUpWhen(card(READY, { due_on: '2026-11-14' }), '09:00')).toBe('on Sat Nov 14 at 9 AM')
    expect(goesUpWhen(card(READY), '09:00')).toBe('today at 9 AM')
    at('09:30')
    expect(goesUpWhen(card(READY), '09:00')).toBe('today, once the draft is made and the Mac is free')
  })
})

describe('the line at the top of the page', () => {
  it('says what\'s next when all is well', () => {
    at('08:12')
    expect(summarize([card(MADE)], '09:00')).toEqual({ title: 'Next up: today at 9 AM', detail: '“Creep” by Radiohead. The draft is ready.' })
    expect(summarize([card(MAKING, { due_on: '2026-11-13' })], '09:00'))
      .toEqual({ title: 'Next up: Fri Nov 13 at 9 AM', detail: '“Creep” by Radiohead. The phone is making the draft.' })
  })

  it('says how late a post is when the Mac is in the way, and what to do', () => {
    at('09:42')
    expect(summarize([card(WAIT_SHARE)], '09:00')).toEqual({
      warn: true,
      title: 'Waiting on your Mac',
      detail: "Wed Nov 11 was due at 9 AM. It's 42 minutes late.",
      todo: 'Unlock the Mac and leave it alone for 30 seconds. Keep the phone nearby and locked.',
    })
  })

  it('says when drafts are waiting on the Mac ahead of their day', () => {
    at('20:00')
    const one = card(WAIT_MAKE, { due_on: '2026-11-13' })
    expect(summarize([one], '09:00').detail).toBe("Fri Nov 13 can't go ahead until it's free.")
    expect(summarize([one, card(WAIT_MAKE, { due_on: '2026-11-14' })], '09:00').detail).toBe("2 chart facts can't go ahead until it's free.")
  })

  it('points at the Mac itself when the job has stopped', () => {
    at('09:40')
    expect(summarize([card(MADE)], '09:00')).toMatchObject({
      warn: true,
      title: "The bot hasn't started sharing Wed Nov 11",
      detail: 'It was due at 9 AM.',
      todo: 'The Mac may be asleep or off. Wake it and leave it alone for 30 seconds.',
    })
  })

  it('says what the bot is doing about a failed share that\'s running late', () => {
    at('09:40')
    expect(summarize([card(RETRY_SHARE)], '09:00')).toMatchObject({
      title: 'Wed Nov 11 is running late',
      detail: "The phone couldn't share it, so it's trying again in 10 minutes.",
    })
  })

  it('counts the cards that need Jett', () => {
    at('08:00')
    const back = card('Three tries failed.', { status: 'waiting', auto_post: false })
    expect(summarize([back], '09:00')).toMatchObject({ warn: true, title: '1 card needs you', detail: "The bot can't take these any further." })
    expect(summarize([back, back, card(MADE, { due_on: '2026-11-12' })], '09:00'))
      .toMatchObject({ title: '2 cards need you', detail: "The bot can't take these any further. It's still working on the rest." })
  })

  it('puts the Mac ahead of a handed-back card, since that\'s the one with a clock on it', () => {
    at('09:42')
    const back = card('Three tries failed.', { status: 'waiting', auto_post: false, due_on: '2026-11-13' })
    expect(summarize([back, card(WAIT_SHARE)], '09:00').title).toBe('Waiting on your Mac')
  })

  it('says when a song changed', () => {
    at('08:00')
    expect(summarize([card(SWAPPED, { status: 'waiting', due_on: '2026-11-15' })], '09:00')).toMatchObject({ warn: true, title: 'Sun Nov 15 has a new song' })
  })

  it('warns when the next post isn\'t approved', () => {
    at('08:00')
    expect(summarize([card(READY, { status: 'waiting' })], '09:00').title).toBe("Today's isn't approved yet")
    expect(summarize([card(READY, { status: 'waiting', due_on: '2026-11-13' }), card(MADE, { due_on: '2026-11-14' })], '09:00').title)
      .toBe("Fri Nov 13 isn't approved yet")
  })

  it('doesn\'t warn about a card that comes after the approved ones', () => {
    at('08:00')
    expect(summarize([card(MADE), card(READY, { status: 'waiting', due_on: '2026-11-18' })], '09:00').title).toBe('Next up: today at 9 AM')
  })

  it('says when it\'s sharing, and when nothing is lined up', () => {
    at('09:01')
    expect(summarize([card(SHARING)], '09:00')).toEqual({ title: 'Sharing Wed Nov 11 now', detail: '“Creep” by Radiohead.' })
    expect(summarize([], '09:00').title).toBe('Nothing lined up')
  })
})

describe('reading times', () => {
  it('says them the way a person would', () => {
    expect(fmtClock('09:00')).toBe('9 AM')
    expect(fmtClock('13:30')).toBe('1:30 PM')
    expect(fmtClock('00:05')).toBe('12:05 AM')
    expect(fmtLate(1)).toBe('1 minute')
    expect(fmtLate(42)).toBe('42 minutes')
    expect(fmtLate(60)).toBe('1 hour')
    expect(fmtLate(125)).toBe('2 hours 5 minutes')
  })
})
