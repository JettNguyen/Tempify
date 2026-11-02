import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { todayEST, fmtDayShort, fmtMonthDayYear } from '../lib/date'
import { getGameName } from '../lib/games'

// Two panels for the marketing plan: the anonymous play counts from
// migration 011, and Premium given by hand from migration 012.

const DAYS = 14

// The same look as Admin's own inputs.
const inputStyle = {
  width: '100%', background: '#111', border: '1px solid var(--border)',
  borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)',
  fontSize: '13px', outline: 'none',
}

const panelStyle = {
  marginTop: '2.5rem', padding: '1.5rem', background: 'var(--surface)',
  border: '1px solid var(--border)', borderRadius: '10px',
}

const titleStyle = { fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.35rem' }
const noteStyle = { fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }
const cellStyle = { padding: '6px 10px', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

const COLUMNS = [
  { key: 'players',  label: 'Players',    help: 'Devices that finished at least one game' },
  { key: 'new',      label: 'New',        help: 'Of those, no game in the seven days before' },
  { key: 'regulars', label: 'Regulars',   help: 'Of those, played on 3 or more of the seven days before' },
  { key: 'links',    label: 'From links', help: 'Players whose visit started from a challenge link, then a shared link' },
  { key: 'shares',   label: 'Shares',     help: 'Taps on Share, then how many of them carried a score to beat' },
  { key: 'archive',  label: 'Archive',    help: 'Games finished from a past day' },
]

function cell(day, key) {
  if (!day) return '0'
  switch (key) {
    case 'links':  return `${day.from_challenge} · ${day.from_share}`
    case 'shares': return `${day.shares} · ${day.challenges_sent}`
    default:       return String(day[key])
  }
}

export function PlayCounts() {
  const [counts, setCounts] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    supabase.rpc('get_play_counts', { p_days: DAYS }).then(({ data, error }) => {
      if (error) setFailed(true)
      else setCounts(data)
    })
  }, [])

  const today = todayEST()
  const byDay = Object.fromEntries((counts?.days || []).map(d => [d.day, d]))
  const dates = Array.from({ length: DAYS }, (_, i) => addDays(today, -i))
  const games = Object.entries(counts?.games || {}).sort((a, b) => b[1] - a[1])

  return (
    <section style={panelStyle}>
      <p style={titleStyle}>Players</p>
      <p style={{ ...noteStyle, marginBottom: '1rem' }}>
        Anonymous counts from the last {DAYS} days. A player is a device that finished a game that day,
        so someone who plays all five counts once. Your own plays aren't counted.
      </p>

      {failed && (
        <p style={noteStyle}>The counts aren't there yet. They start once migration 011 has run on the database.</p>
      )}

      {counts && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '13px', color: 'var(--text-primary)', width: '100%' }}>
              <thead>
                <tr style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                  <th style={{ ...cellStyle, textAlign: 'left', fontWeight: 400 }}>Day</th>
                  {COLUMNS.map(c => (
                    <th key={c.key} title={c.help} style={{ ...cellStyle, fontWeight: 400 }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dates.map(date => (
                  <tr key={date} style={{ borderTop: '1px solid var(--border)', color: byDay[date] ? 'var(--text-primary)' : 'var(--text-dim)' }}>
                    <td style={{ ...cellStyle, textAlign: 'left' }}>{fmtDayShort(date)}</td>
                    {COLUMNS.map(c => <td key={c.key} style={cellStyle}>{cell(byDay[date], c.key)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ ...noteStyle, marginTop: '0.75rem' }}>
            From links: challenge links · shared links. Shares: all · with a score to beat.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginTop: '1.25rem' }}>
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '6px' }}>Where players came from</p>
              {counts.referrers.length === 0
                ? <p style={noteStyle}>No other site has sent anyone yet.</p>
                : counts.referrers.map(r => (
                  <p key={r.host} style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{r.host}</span><span>{r.players}</span>
                  </p>
                ))}
            </div>
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '6px' }}>Games finished</p>
              {games.length === 0
                ? <p style={noteStyle}>None yet.</p>
                : games.map(([slug, n]) => (
                  <p key={slug} style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{getGameName(slug)}</span><span>{n}</span>
                  </p>
                ))}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export function GivePremium() {
  const [comps, setComps] = useState([])
  const [names, setNames] = useState({})
  const [username, setUsername] = useState('')
  const [days, setDays] = useState('90')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [armedId, setArmedId] = useState(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('premium_comps')
      .select('user_id, until, note')
      .order('until', { ascending: false })
    if (error) { setFailed(true); return }
    setComps(data || [])
    const ids = (data || []).map(c => c.user_id)
    if (!ids.length) return
    const { data: users } = await supabase.from('profiles').select('id, username').in('id', ids)
    setNames(Object.fromEntries((users || []).map(u => [u.id, u.username])))
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!armedId) return
    const t = setTimeout(() => setArmedId(null), 4000)
    return () => clearTimeout(t)
  }, [armedId])

  async function give(e) {
    e.preventDefault()
    setMessage(null)
    const name = username.trim().replace(/^@/, '').toLowerCase()
    const length = Math.round(Number(days))
    if (!name) { setMessage('Type their username.'); return }
    if (!(length >= 1 && length <= 3650)) { setMessage('Days has to be a number from 1 to 3650.'); return }
    setBusy(true)
    const { data: found } = await supabase.from('profiles').select('id, username').eq('username', name).maybeSingle()
    if (!found) {
      setBusy(false)
      setMessage(`No player is named ${name}. They need an account with a username first.`)
      return
    }
    const until = addDays(todayEST(), length)
    const { error } = await supabase
      .from('premium_comps')
      .upsert({ user_id: found.id, until, note: note.trim() || null })
    setBusy(false)
    if (error) { setMessage(`That didn't save: ${error.message}`); return }
    setMessage(`${found.username} has Premium through ${fmtMonthDayYear(until)}. It shows the next time they open the app.`)
    setUsername('')
    setNote('')
    load()
  }

  async function end(userId) {
    if (armedId !== userId) { setArmedId(userId); return }
    setArmedId(null)
    await supabase.from('premium_comps').delete().eq('user_id', userId)
    load()
  }

  const today = todayEST()

  return (
    <section style={panelStyle}>
      <p style={titleStyle}>Give Premium</p>
      <p style={{ ...noteStyle, marginBottom: '1rem' }}>
        For a streamer or an early player. It runs out on its own and never touches a paid plan.
      </p>

      {failed ? (
        <p style={noteStyle}>This starts working once migration 012 has run on the database.</p>
      ) : (
        <>
          <form onSubmit={give} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
            <label>
              <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>Username</p>
              <input value={username} onChange={e => setUsername(e.target.value)} placeholder="dana" style={inputStyle} autoCapitalize="none" />
            </label>
            <label>
              <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>Days</p>
              <input value={days} onChange={e => setDays(e.target.value)} type="number" min="1" max="3650" style={inputStyle} />
            </label>
            <label>
              <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>Note</p>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="streams on Twitch" maxLength={200} style={inputStyle} />
            </label>
            <button type="submit" disabled={busy} className="btn-press" style={{
              padding: '9px 20px', background: 'var(--amber)', border: 'none', borderRadius: '999px',
              color: '#0f0f0f', fontSize: '13px', fontWeight: 500, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1,
            }}>
              {busy ? 'Giving…' : 'Give Premium'}
            </button>
          </form>
          {message && <p style={{ ...noteStyle, marginTop: '0.75rem' }}>{message}</p>}

          {comps.length > 0 && (
            <div style={{ marginTop: '1.25rem' }}>
              {comps.map(c => {
                const over = c.until < today
                return (
                  <div key={c.user_id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-primary)', flex: '0 0 auto' }}>{names[c.user_id] || 'someone'}</span>
                    <span style={{ color: 'var(--text-muted)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {over ? 'ended' : 'through'} {fmtMonthDayYear(c.until)}{c.note ? ` · ${c.note}` : ''}
                    </span>
                    <button onClick={() => end(c.user_id)} className="btn-press" style={{
                      padding: '5px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '999px',
                      color: armedId === c.user_id ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '12px', cursor: 'pointer',
                    }}>
                      {armedId === c.user_id ? 'Tap again to remove' : 'Remove'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </section>
  )
}
