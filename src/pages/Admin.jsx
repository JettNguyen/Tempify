import { useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { GENRES } from '../lib/genres'

const GAMES = [
  { slug: 'one-bar',        short: 'One Bar' },
  { slug: 'drop-or-flop',   short: 'Drop/Flop' },
  { slug: 'who-sampled-it', short: 'Sampled' },
  { slug: 'era',            short: 'Era' },
  { slug: 'the-flip',       short: 'Flip' },
]

const DECADES = ['60s','70s','80s','90s','00s','10s','20s']

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function dateRange(start, count) {
  return Array.from({ length: count }, (_, i) => addDays(start, i))
}

function fmtDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

const BLANK = {
  date: '', game: 'one-bar', audioUrl: '', answer: '', genre: '',
  // shared
  artist: '', year: '',
  // drop-or-flop
  verdict: 'hit', peakPosition: '1', weeksAtOne: '', hint: '',
  // who-sampled-it
  sourceSong: '', sourceArtist: '', sourceYear: '',
  sampleArtist: '', sampleYear: '', correctArtist: '',
  opt2Title: '', opt2Artist: '', opt3Title: '', opt3Artist: '',
  opt4Title: '', opt4Artist: '',
  // era
  songTitle: '',
  // the-flip
  vATitle: '', vAArtist: '', vAYear: '', vAAudio: '',
  vBTitle: '', vBArtist: '', vBYear: '', vBAudio: '',
  flipAnswer: 'A',
}

function buildRow(f) {
  let meta = {}
  let audioUrl = f.audioUrl
  let answer = f.answer

  switch (f.game) {
    case 'one-bar':
      meta = { artist: f.artist, year: Number(f.year) }
      break
    case 'drop-or-flop':
      meta = {
        artist: f.artist, year: Number(f.year),
        verdict: f.verdict,
        peak_position: f.verdict === 'hit' ? Number(f.peakPosition) || 0 : 0,
        weeks_at_one: Number(f.weeksAtOne) || 0,
        hint: f.hint || null,
      }
      break
    case 'who-sampled-it':
      meta = {
        sample_artist: f.sampleArtist, sample_year: Number(f.sampleYear),
        source_song: f.sourceSong, source_artist: f.sourceArtist,
        source_year: Number(f.sourceYear),
        options: [
          { title: f.answer,    artist: f.correctArtist },
          { title: f.opt2Title, artist: f.opt2Artist },
          { title: f.opt3Title, artist: f.opt3Artist },
          { title: f.opt4Title, artist: f.opt4Artist },
        ],
      }
      break
    case 'era':
      answer = f.answer // decade string like "90s"
      meta = { title: f.songTitle, artist: f.artist, year: Number(f.year), decade: f.answer }
      break
    case 'the-flip':
      answer = f.flipAnswer
      audioUrl = f.vAAudio // unused by game but required by schema
      meta = {
        version_a: { title: f.vATitle, artist: f.vAArtist, year: Number(f.vAYear), audio_url: f.vAAudio },
        version_b: { title: f.vBTitle, artist: f.vBArtist, year: Number(f.vBYear), audio_url: f.vBAudio },
      }
      break
  }

  return {
    game_slug: f.game,
    scheduled_date: f.date,
    audio_url: audioUrl,
    answer,
    genre: f.genre || null,
    metadata: meta,
  }
}

// ─── Input helper ────────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%', background: '#111', border: '1px solid var(--border)',
  borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)',
  fontSize: '13px', outline: 'none',
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>{label}</p>
      {children}
    </div>
  )
}

function Input({ value, onChange, ...props }) {
  return <input value={value} onChange={e => onChange(e.target.value)} style={inputStyle} {...props} />
}

// ─── Game-specific form sections ─────────────────────────────────────────────
function OneBarFields({ f, set }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="Artist"><Input value={f.artist} onChange={v => set('artist', v)} placeholder="The Weeknd" /></Field>
      <Field label="Year"><Input value={f.year} onChange={v => set('year', v)} placeholder="2019" type="number" /></Field>
    </div>
  )
}

function DropOrFlopFields({ f, set }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <Field label="Artist"><Input value={f.artist} onChange={v => set('artist', v)} /></Field>
        <Field label="Year"><Input value={f.year} onChange={v => set('year', v)} type="number" /></Field>
      </div>
      <Field label="Verdict">
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['hit', 'miss'].map(v => (
            <button key={v} type="button" onClick={() => set('verdict', v)} style={{
              flex: 1, padding: '7px', borderRadius: '6px', border: '1px solid',
              borderColor: f.verdict === v ? 'var(--amber)' : 'var(--border)',
              background: f.verdict === v ? 'var(--amber-glow)' : 'transparent',
              color: f.verdict === v ? 'var(--amber)' : 'var(--text-muted)',
              fontSize: '13px', cursor: 'pointer',
            }}>{v}</button>
          ))}
        </div>
      </Field>
      {f.verdict === 'hit' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <Field label="Peak position"><Input value={f.peakPosition} onChange={v => set('peakPosition', v)} type="number" /></Field>
          <Field label="Weeks at #1"><Input value={f.weeksAtOne} onChange={v => set('weeksAtOne', v)} type="number" /></Field>
        </div>
      )}
      <Field label="Hint (optional)"><Input value={f.hint} onChange={v => set('hint', v)} placeholder="Billboard context..." /></Field>
    </>
  )
}

function WhoSampledFields({ f, set }) {
  return (
    <>
      <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '0.75rem' }}>
        Song that <em>contains</em> the sample
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <Field label="Source song title"><Input value={f.sourceSong} onChange={v => set('sourceSong', v)} /></Field>
        <Field label="Source artist"><Input value={f.sourceArtist} onChange={v => set('sourceArtist', v)} /></Field>
        <Field label="Year"><Input value={f.sourceYear} onChange={v => set('sourceYear', v)} type="number" /></Field>
      </div>
      <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '0.75rem' }}>
        Original sample (the correct answer is the Answer field above)
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <Field label="Correct sample artist"><Input value={f.correctArtist} onChange={v => set('correctArtist', v)} /></Field>
        <Field label="Year"><Input value={f.sampleYear} onChange={v => set('sampleYear', v)} type="number" /></Field>
      </div>
      <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>3 wrong options</p>
      {[
        ['opt2Title','opt2Artist'],
        ['opt3Title','opt3Artist'],
        ['opt4Title','opt4Artist'],
      ].map(([t, a], i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Input value={f[t]} onChange={v => set(t, v)} placeholder={`Option ${i+2} title`} />
          <Input value={f[a]} onChange={v => set(a, v)} placeholder="Artist" />
        </div>
      ))}
    </>
  )
}

function EraFields({ f, set }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <Field label="Song title"><Input value={f.songTitle} onChange={v => set('songTitle', v)} /></Field>
        <Field label="Artist"><Input value={f.artist} onChange={v => set('artist', v)} /></Field>
        <Field label="Year"><Input value={f.year} onChange={v => set('year', v)} type="number" /></Field>
      </div>
      <Field label="Correct decade (also set as Answer above)">
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {DECADES.map(d => (
            <button key={d} type="button" onClick={() => { set('answer', d) }} style={{
              padding: '6px 12px', borderRadius: '999px', border: '1px solid',
              borderColor: f.answer === d ? 'var(--amber)' : 'var(--border)',
              background: f.answer === d ? 'var(--amber-glow)' : 'transparent',
              color: f.answer === d ? 'var(--amber)' : 'var(--text-muted)',
              fontSize: '12px', cursor: 'pointer',
            }}>{d}</button>
          ))}
        </div>
      </Field>
    </>
  )
}

function FlipFields({ f, set }) {
  return (
    <>
      {[['A', 'vATitle','vAArtist','vAYear','vAAudio'], ['B','vBTitle','vBArtist','vBYear','vBAudio']].map(([ver, t, a, y, u]) => (
        <div key={ver} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>Version {ver}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Input value={f[t]} onChange={v => set(t, v)} placeholder="Song title" />
            <Input value={f[a]} onChange={v => set(a, v)} placeholder="Artist" />
            <Input value={f[y]} onChange={v => set(y, v)} placeholder="Year" type="number" />
          </div>
          <Input value={f[u]} onChange={v => set(u, v)} placeholder="Audio URL" />
        </div>
      ))}
      <Field label="Which version came first?">
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['A','B'].map(v => (
            <button key={v} type="button" onClick={() => set('flipAnswer', v)} style={{
              flex: 1, padding: '7px', borderRadius: '6px', border: '1px solid',
              borderColor: f.flipAnswer === v ? 'var(--amber)' : 'var(--border)',
              background: f.flipAnswer === v ? 'var(--amber-glow)' : 'transparent',
              color: f.flipAnswer === v ? 'var(--amber)' : 'var(--text-muted)',
              fontSize: '13px', cursor: 'pointer',
            }}>Version {v}</button>
          ))}
        </div>
      </Field>
    </>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function Admin() {
  const { user, loading } = useAuth()
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL

  const [puzzles, setPuzzles]   = useState([])
  const [weekOffset, setWeekOffset] = useState(0)
  const [form, setForm]         = useState(BLANK)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  if (loading) return null
  if (!user || !adminEmail || user.email !== adminEmail) return <Navigate to="/" replace />

  const today = new Date().toISOString().split('T')[0]
  const startDate = addDays(today, weekOffset * 14)
  const dates = dateRange(startDate, 14)
  const endDate = dates[dates.length - 1]

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const fetchSchedule = useCallback(async () => {
    const { data } = await supabase
      .from('puzzles')
      .select('id, game_slug, scheduled_date, answer, genre')
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date')
    setPuzzles(data || [])
  }, [startDate, endDate])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { fetchSchedule() }, [fetchSchedule])

  // Build a lookup: "date|game_slug" → puzzle row
  const scheduled = {}
  puzzles.forEach(p => { scheduled[`${p.scheduled_date}|${p.game_slug}`] = p })

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function openForm(date, gameSlug) {
    setForm({ ...BLANK, date, game: gameSlug })
    setShowForm(true)
    setTimeout(() => document.getElementById('admin-form')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  async function handleDelete(id) {
    setDeletingId(id)
    await supabase.from('puzzles').delete().eq('id', id)
    await fetchSchedule()
    setDeletingId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!form.date || !form.answer) { setError('Date and Answer are required.'); return }
    setSaving(true)
    const { error: err } = await supabase.from('puzzles').insert(buildRow(form))
    setSaving(false)
    if (err) { setError(err.message); return }
    await fetchSchedule()
    setForm(BLANK)
    setShowForm(false)
  }

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', padding: '88px 1.25rem 6rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>admin</p>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Puzzle schedule
        </h1>
      </div>

      {/* Week navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button onClick={() => setWeekOffset(w => w - 1)} style={navBtn}>← prev</button>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {fmtDate(startDate)} — {fmtDate(endDate)}
        </span>
        <button onClick={() => setWeekOffset(w => w + 1)} style={navBtn}>next →</button>
        {weekOffset !== 0 && (
          <button onClick={() => setWeekOffset(0)} style={{ ...navBtn, color: 'var(--amber)' }}>today</button>
        )}
      </div>

      {/* Schedule grid */}
      <div style={{ overflowX: 'auto', marginBottom: '2.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>
              <th style={thStyle}>Date</th>
              {GAMES.map(g => <th key={g.slug} style={thStyle}>{g.short}</th>)}
            </tr>
          </thead>
          <tbody>
            {dates.map(date => (
              <tr key={date}>
                <td style={{ ...tdStyle, color: date === today ? 'var(--amber)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {fmtDate(date)}
                  {date === today && <span style={{ marginLeft: '4px', fontSize: '10px' }}>·today</span>}
                </td>
                {GAMES.map(game => {
                  const key = `${date}|${game.slug}`
                  const existing = scheduled[key]
                  return (
                    <td key={game.slug} style={tdStyle}>
                      {existing ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            display: 'inline-block', width: '7px', height: '7px',
                            borderRadius: '50%', background: 'var(--green)', flexShrink: 0,
                          }} />
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }} title={existing.answer}>
                            {existing.answer}
                          </span>
                          <button
                            onClick={() => handleDelete(existing.id)}
                            disabled={deletingId === existing.id}
                            style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontSize: '11px', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                            title="Delete"
                          >✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => openForm(date, game.slug)}
                          style={{
                            color: 'var(--text-dim)', fontSize: '16px', lineHeight: 1,
                            background: 'none', border: '1px dashed var(--border)',
                            borderRadius: '4px', width: '100%', padding: '2px 0',
                            cursor: 'pointer', transition: 'border-color 80ms ease, color 80ms ease',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.color = 'var(--amber)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
                          title={`Add ${game.short} for ${date}`}
                        >+</button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add puzzle form */}
      {showForm && (
        <div id="admin-form" style={{
          padding: '1.75rem',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Add puzzle</p>
            <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-dim)', fontSize: '18px', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Date + game */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <Field label="Date">
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Game">
                <select value={form.game} onChange={e => set('game', e.target.value)} style={inputStyle}>
                  {GAMES.map(g => <option key={g.slug} value={g.slug}>{g.short}</option>)}
                </select>
              </Field>
            </div>

            {/* Genre */}
            <Field label="Genre">
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {GENRES.map(g => (
                  <button key={g} type="button" onClick={() => set('genre', g)} style={{
                    padding: '4px 10px', borderRadius: '999px', fontSize: '11px', border: '1px solid',
                    borderColor: form.genre === g ? 'var(--amber)' : 'var(--border)',
                    background: form.genre === g ? 'var(--amber-glow)' : 'transparent',
                    color: form.genre === g ? 'var(--amber)' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}>{g}</button>
                ))}
              </div>
            </Field>

            {/* Audio URL + Answer — common to all games */}
            <Field label={form.game === 'the-flip' ? 'Audio URL (Version A)' : 'Audio URL'}>
              <Input value={form.audioUrl} onChange={v => set('audioUrl', v)} placeholder="https://audio-ssl.itunes.apple.com/..." />
            </Field>

            {form.game !== 'the-flip' && form.game !== 'era' && (
              <Field label="Answer (song title)">
                <Input value={form.answer} onChange={v => set('answer', v)} placeholder="Exact song title" />
              </Field>
            )}

            {/* Game-specific fields */}
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              {form.game === 'one-bar'        && <OneBarFields    f={form} set={set} />}
              {form.game === 'drop-or-flop'   && <DropOrFlopFields f={form} set={set} />}
              {form.game === 'who-sampled-it' && <WhoSampledFields f={form} set={set} />}
              {form.game === 'era'            && <EraFields        f={form} set={set} />}
              {form.game === 'the-flip'       && <FlipFields       f={form} set={set} />}
            </div>

            {error && (
              <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '0.75rem' }}>{error}</p>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button type="submit" disabled={saving} className="btn-press" style={{
                padding: '9px 20px', background: 'var(--amber)', border: 'none',
                borderRadius: '999px', color: '#0f0f0f', fontSize: '13px',
                fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
              }}>
                {saving ? 'Saving…' : 'Add puzzle'}
              </button>
              <button type="button" onClick={() => { setForm(BLANK); setShowForm(false) }} style={{
                padding: '9px 20px', background: 'transparent', border: '1px solid var(--border)',
                borderRadius: '999px', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer',
              }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {!showForm && (
        <button onClick={() => setShowForm(true)} className="btn-press" style={{
          padding: '9px 20px', background: 'transparent', border: '1px solid var(--border)',
          borderRadius: '999px', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer',
        }}>
          + Add puzzle
        </button>
      )}
    </div>
  )
}

const thStyle = {
  textAlign: 'left', padding: '8px 10px', fontSize: '11px',
  color: 'var(--text-dim)', borderBottom: '1px solid var(--border)',
  fontWeight: 500,
}
const tdStyle = {
  padding: '8px 10px', borderBottom: '1px solid var(--border)',
  verticalAlign: 'middle',
}
const navBtn = {
  fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none',
  cursor: 'pointer', padding: '4px 0',
}
