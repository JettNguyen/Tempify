import { useState } from 'react'
import AudioPlayer from '../components/AudioPlayer'
import {
  draftPeak, redraftPeakRound, draftTimeline, redraftTimelineRound, draftTempo, redraftTempoRound,
  songKey, commonGenre, dayLevel, timelineGap,
} from '../lib/drafts'
import { addTap, bpmFromTaps } from '../lib/tempo'
import { yearToDecade } from '../lib/decades'

// The games whose day is five songs instead of one, and the puzzle kind each
// one drafts. Hit or Miss is Peak's dial; Era is the timeline.
export const ROUNDS_GAMES = { 'hit-or-miss': 'peak', era: 'timeline', tempo: 'tempo' }

// Games that were never one song, so there's no older format to pick.
export const ROUNDS_ONLY = new Set(['tempo'])

export const ROUND_COUNT = 5

const KINDS = {
  peak: {
    draft: draftPeak,
    redraft: redraftPeakRound,
    help: 'One song from each stretch of the chart (#1-5, #6-20, #21-50, #51-100) and one that never charted, shuffled. Listen to each: the clip must be the charting recording, not a live take, remix or cover, and a "never charted" song must not have charted under another title.',
  },
  timeline: {
    draft: draftTimeline,
    redraft: redraftTimelineRound,
    help: (level) => `Five big hits at least ${timelineGap(level)} years apart. The first one starts on the line with its year showing; players place the other four. Years are when each song first charted. Listen to each: the clip must be the hit recording.`,
  },
  tempo: {
    draft: draftTempo,
    redraft: redraftTempoRound,
    help: "Five top-ten hits with a tempo from Deezer. Deezer sometimes reads a slow song at double time, so play each clip and tap along: if your tap is about half or double the stored tempo, use yours. Pick songs with a steady beat; players count half or double time as right either way.",
  },
}

// How a draft's day of the week reads in Admin, from Monday's 1 to Sunday's 7.
const LEVEL_NOTES = [
  'the easiest day, so the draft picks songs nearly everyone knows',
  'an easy day, so the draft picks well known songs',
  'a middle day',
  'a middle day',
  'a middle day',
  'a hard day, so the draft leaves out the most famous songs',
  'the hardest day, so the draft picks songs mostly fans will know',
]

function levelNote(date) {
  if (!date) return 'Pick a date first: Mondays draft the easiest songs and Sundays the hardest.'
  const [y, m, d] = date.split('-').map(Number)
  const weekday = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' })
  return `${weekday} is ${LEVEL_NOTES[dayLevel(date) - 1]}.`
}

/**
 * The day's first song in the one-song fields. iPhone apps from before
 * five-song days (1.9 and older) carry their own copy of the games and read
 * only these, so they play that one song; the five-song games read `rounds`.
 */
export function firstSongFields(kind, rounds) {
  const first = rounds[0]
  if (!first) return null
  if (kind === 'peak') {
    return {
      answer: first.title,
      metadata: {
        artist: first.artist,
        year: first.year,
        artwork_url: first.artwork_url,
        // The old game's "hit" is any song that made the Hot 100 at all.
        verdict: first.peak ? 'hit' : 'miss',
        peak_position: first.peak || null,
        weeks_at_one: first.weeks_at_one || 0,
        hint: null,
      },
    }
  }
  if (kind === 'timeline') {
    const decade = yearToDecade(first.year)
    return {
      answer: decade,
      metadata: { title: first.title, artist: first.artist, year: first.year, decade, artwork_url: first.artwork_url },
    }
  }
  return null
}

const BLANK_ROUND = { title: '', artist: '', year: '', audio_url: '', artwork_url: '', itunes_url: '' }

/** Every song a game has already used, single or five-song days, keyed by date. */
export function usedSongs(puzzles, excludeId) {
  const used = new Map()
  for (const p of puzzles) {
    if (p.id === excludeId) continue
    const m = p.metadata || {}
    const songs = Array.isArray(m.rounds)
      ? m.rounds
      : [{ title: m.title || p.answer, artist: m.artist }]
    songs.forEach(s => { if (s.title) used.set(songKey(s.title, s.artist || ''), p.scheduled_date) })
  }
  return used
}

export function validateRounds(kind, rounds, used) {
  const err = []
  if (rounds.length !== ROUND_COUNT) err.push(`${ROUND_COUNT} songs (has ${rounds.length})`)
  rounds.forEach((r, i) => {
    const n = i + 1
    if (!r.title || !r.artist) err.push(`Song ${n} title and artist`)
    if (!r.audio_url) err.push(`Song ${n} clip`)
    if (kind === 'timeline' && !Number(r.year)) err.push(`Song ${n} year`)
    if (kind === 'tempo' && !(Number(r.bpm) >= 40 && Number(r.bpm) <= 240)) err.push(`Song ${n} tempo (40 to 240)`)
    if (kind === 'peak' && (r.peak === '' || r.peak == null || Number(r.peak) < 0 || Number(r.peak) > 100)) {
      err.push(`Song ${n} peak (0 to 100)`)
    }
    if (used.has(songKey(r.title, r.artist))) err.push(`Song ${n} was used before`)
  })
  return err
}

/** A day's rounds as the puzzle stores them, numbers as numbers. */
export function cleanRounds(kind, rounds) {
  return rounds.map(r => {
    const out = {
      title: r.title.trim(),
      artist: r.artist.trim(),
      year: Number(r.year) || null,
      audio_url: r.audio_url.trim(),
      artwork_url: r.artwork_url || null,
      itunes_url: r.itunes_url || null,
    }
    if (kind === 'peak') {
      out.peak = Number(r.peak) || 0
      out.weeks_on_chart = Number(r.weeks_on_chart) || 0
      out.weeks_at_one = Number(r.weeks_at_one) || 0
    }
    if (kind === 'tempo') out.bpm = Math.round(Number(r.bpm))
    return out
  })
}

const inputStyle = {
  width: '100%', background: '#111', border: '1px solid var(--border)',
  borderRadius: '6px', padding: '7px 9px', color: 'var(--text-primary)',
  fontSize: '13px', outline: 'none',
}

const smallBtn = {
  padding: '6px 12px', borderRadius: '999px', border: '1px solid var(--border)',
  background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer',
}

/** Tap along with a clip to read its tempo, for checking or replacing a stored one. */
function TapAlong({ onUse }) {
  const [taps, setTaps] = useState([])
  const bpm = bpmFromTaps(taps)
  return (
    <span style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
      <button type="button" onPointerDown={() => setTaps(t => addTap(t, performance.now()))} style={{ ...smallBtn, minWidth: '96px' }}>
        {bpm ? `Tap: ${bpm}` : taps.length ? `Tap (${taps.length})` : 'Tap along'}
      </button>
      {bpm && <button type="button" onClick={() => { onUse(bpm); setTaps([]) }} style={smallBtn}>Use {bpm}</button>}
    </span>
  )
}

function Mini({ label, children, grow }) {
  return (
    <label style={{ display: 'block', flex: grow ? 1 : undefined, minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-dim)', marginBottom: '3px' }}>{label}</span>
      {children}
    </label>
  )
}

export default function RoundsFields({ kind, date, rounds, setRounds, setGenre, used }) {
  const [busy, setBusy] = useState(null) // 'all', or the index being swapped
  const [found, setFound] = useState(0)
  const [message, setMessage] = useState(null)
  const spec = KINDS[kind]
  const usedKeys = new Set(used.keys())
  const level = dayLevel(date)
  const help = typeof spec.help === 'function' ? spec.help(level) : spec.help

  async function draftAll() {
    setBusy('all')
    setFound(0)
    setMessage(null)
    try {
      const next = await spec.draft({ used: usedKeys, level, onProgress: setFound })
      setRounds(next)
      const genre = commonGenre(next)
      if (genre) setGenre(genre)
      if (next.length < ROUND_COUNT) {
        setMessage(`Found clips for ${next.length} of ${ROUND_COUNT}. Draft again, or add the rest by hand.`)
      }
    } catch (err) {
      setMessage(`The draft stopped: ${err.message}. Try again in a minute; the store's search allows about 20 lookups a minute.`)
    } finally {
      setBusy(null)
    }
  }

  async function swap(i) {
    setBusy(i)
    setMessage(null)
    try {
      const round = await spec.redraft(rounds, i, { used: usedKeys, level })
      if (round) setRounds(rounds.map((r, j) => (j === i ? round : r)))
      else setMessage(`No other song with a clip turned up for song ${i + 1}. Try again, or type one in.`)
    } catch (err) {
      setMessage(`The swap stopped: ${err.message}. Try again in a minute.`)
    } finally {
      setBusy(null)
    }
  }

  function edit(i, key, value) {
    setRounds(rounds.map((r, j) => (j === i ? { ...r, [key]: value } : r)))
  }

  function remove(i) {
    setRounds(rounds.filter((_, j) => j !== i))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <button type="button" onClick={draftAll} disabled={busy !== null} className="btn-press" style={{
          ...smallBtn, background: 'var(--amber)', borderColor: 'var(--amber)', color: '#0f0f0f', fontWeight: 600,
          opacity: busy !== null ? 0.5 : 1,
        }}>
          {busy === 'all' ? `Finding clips (${found} of ${ROUND_COUNT})` : rounds.length ? 'Draft a new set' : 'Draft five songs'}
        </button>
        {rounds.length < ROUND_COUNT && (
          <button type="button" onClick={() => setRounds([...rounds, { ...BLANK_ROUND, ...(kind === 'peak' ? { peak: '' } : {}) }])} style={smallBtn}>
            + Add a song by hand
          </button>
        )}
      </div>
      <p style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: '0.75rem' }}>{levelNote(date)} {help}</p>
      {message && <p style={{ fontSize: '12px', color: 'var(--amber)', marginBottom: '0.75rem' }}>{message}</p>}

      {rounds.map((r, i) => {
        const usedOn = r.title ? used.get(songKey(r.title, r.artist || '')) : null
        return (
          <div key={i} style={{
            padding: '0.75rem', marginBottom: '0.5rem', borderRadius: '8px',
            border: `1px solid ${usedOn ? '#ef4444' : 'var(--border)'}`, background: '#0d0d0d',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                Song {i + 1}{kind === 'timeline' && i === 0 ? ' (placed for you, year shown)' : ''}
              </span>
              <span style={{ display: 'flex', gap: '6px' }}>
                <button type="button" onClick={() => swap(i)} disabled={busy !== null} style={{ ...smallBtn, opacity: busy !== null ? 0.5 : 1 }}>
                  {busy === i ? 'Swapping...' : 'Swap'}
                </button>
                <button type="button" onClick={() => remove(i)} style={smallBtn}>Remove</button>
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Mini label="Title" grow><input value={r.title} onChange={e => edit(i, 'title', e.target.value)} style={inputStyle} /></Mini>
              <Mini label="Artist" grow><input value={r.artist} onChange={e => edit(i, 'artist', e.target.value)} style={inputStyle} /></Mini>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Mini label={kind === 'timeline' ? 'Year it first charted' : 'Year'}>
                <input value={r.year ?? ''} onChange={e => edit(i, 'year', e.target.value)} type="number" style={{ ...inputStyle, width: '80px' }} />
              </Mini>
              {kind === 'tempo' && (
                <>
                  <Mini label="Tempo (BPM)">
                    <input value={r.bpm ?? ''} onChange={e => edit(i, 'bpm', e.target.value)} type="number" style={{ ...inputStyle, width: '80px' }} />
                  </Mini>
                  <TapAlong onUse={bpm => edit(i, 'bpm', bpm)} />
                </>
              )}
              {kind === 'peak' && (
                <>
                  <Mini label="Peak (0 = never charted)">
                    <input value={r.peak ?? ''} onChange={e => edit(i, 'peak', e.target.value)} type="number" min="0" max="100" style={{ ...inputStyle, width: '90px' }} />
                  </Mini>
                  <Mini label="Weeks on chart">
                    <input value={r.weeks_on_chart ?? ''} onChange={e => edit(i, 'weeks_on_chart', e.target.value)} type="number" style={{ ...inputStyle, width: '80px' }} />
                  </Mini>
                  <Mini label="Weeks at #1">
                    <input value={r.weeks_at_one ?? ''} onChange={e => edit(i, 'weeks_at_one', e.target.value)} type="number" style={{ ...inputStyle, width: '80px' }} />
                  </Mini>
                </>
              )}
            </div>

            <Mini label="Clip URL" grow>
              <input value={r.audio_url} onChange={e => edit(i, 'audio_url', e.target.value)} placeholder="https://audio-ssl.itunes.apple.com/..." style={inputStyle} />
            </Mini>
            {r.audio_url && (
              <div style={{ marginTop: '0.5rem' }}>
                <AudioPlayer key={r.audio_url} src={r.audio_url} />
              </div>
            )}
            {usedOn && (
              <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '0.5rem' }}>
                Already used in this game on {usedOn}. Swap it.
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
