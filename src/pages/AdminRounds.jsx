import { useState } from 'react'
import AudioPlayer from '../components/AudioPlayer'
import {
  draftPeak, redraftPeakRound, draftTimeline, redraftTimelineRound, songKey, commonGenre,
} from '../lib/drafts'

// The games whose day is five songs instead of one, and the puzzle kind each
// one drafts. Hit or Miss is Peak's dial.
export const ROUNDS_GAMES = { 'hit-or-miss': 'peak' }

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
    help: 'Five big hits at least three years apart. The first one starts on the line with its year showing; players place the other four. Years are when each song first charted. Listen to each: the clip must be the hit recording.',
  },
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

function Mini({ label, children, grow }) {
  return (
    <label style={{ display: 'block', flex: grow ? 1 : undefined, minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-dim)', marginBottom: '3px' }}>{label}</span>
      {children}
    </label>
  )
}

export default function RoundsFields({ kind, rounds, setRounds, setGenre, used }) {
  const [busy, setBusy] = useState(null) // 'all', or the index being swapped
  const [found, setFound] = useState(0)
  const [message, setMessage] = useState(null)
  const spec = KINDS[kind]
  const usedKeys = new Set(used.keys())

  async function draftAll() {
    setBusy('all')
    setFound(0)
    setMessage(null)
    try {
      const next = await spec.draft({ used: usedKeys, onProgress: setFound })
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
      const round = await spec.redraft(rounds, i, { used: usedKeys })
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
      <p style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: '0.75rem' }}>{spec.help}</p>
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
