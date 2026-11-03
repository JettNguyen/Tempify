import { useState, useEffect, useCallback } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { fmtDayShort } from '../lib/date'
import { getGameName } from '../lib/games'
import { isNativeApp } from '../lib/oauth'
import { PlayCounts } from './AdminPlayers'

// The Tempify bot's side of Admin, on one screen for the phone: what it
// drafted for Jett to look at, what it did, and the play counts. The tables
// are migrations 014 and 015; the bot's prompt (in Drive) says how it fills
// them. A post the bot can put up itself (auto_post, Instagram) gets "Post
// it", which approves it for the bot. Any other post Jett puts up himself,
// so its answer is "Posted". Puzzles are already live, so "Send back" asks
// for a fix before their day.

const LOG_ROWS = 40
const PICTURE_LINK_SECONDS = 3600

const inputStyle = {
  width: '100%', background: '#111', border: '1px solid var(--border)',
  borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)',
  fontSize: '13px', outline: 'none',
}

const panelStyle = {
  marginTop: '1.5rem', padding: '1.25rem', background: 'var(--surface)',
  border: '1px solid var(--border)', borderRadius: '10px',
}

const titleStyle = { fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.35rem' }
const noteStyle = { fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }
const tagStyle = { fontSize: '11px', color: 'var(--text-dim)' }

const buttonStyle = {
  padding: '9px 16px', borderRadius: '999px', fontSize: '13px', cursor: 'pointer',
  border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)',
}
const primaryStyle = { ...buttonStyle, background: 'var(--text-primary)', color: 'var(--bg)', border: '1px solid var(--text-primary)' }

const KIND_LABEL = { post: 'Post', puzzle: 'Puzzle', note: 'Note' }

function fmtWhen(iso) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// A post's pictures from the bot's private bucket, and the same pictures as
// files for the share sheet where the browser can share files. The files are
// fetched as soon as the links arrive, because Safari only opens the share
// sheet straight from a tap, with nothing to wait on in between.
function usePictures(paths) {
  const [urls, setUrls] = useState(null)
  const [files, setFiles] = useState(null)
  const key = (paths || []).join('|')

  useEffect(() => {
    if (!key) return
    let live = true
    const list = key.split('|')
    supabase.storage.from('agent').createSignedUrls(list, PICTURE_LINK_SECONDS).then(async ({ data, error }) => {
      if (!live || error || !data) return
      const signed = data.map(d => d.signedUrl).filter(Boolean)
      setUrls(signed)
      if (isNativeApp() || !navigator.canShare) return
      try {
        const made = await Promise.all(signed.map(async (url, i) => {
          const res = await fetch(url)
          if (!res.ok) throw new Error(`picture ${i + 1}: ${res.status}`)
          const blob = await res.blob()
          return new File([blob], list[i].split('/').slice(-2).join('-'), { type: blob.type || 'image/jpeg' })
        }))
        if (live && navigator.canShare({ files: made })) setFiles(made)
      } catch {
        // No share button then. The pictures still show.
      }
    })
    return () => { live = false }
  }, [key])

  return { urls, files }
}

function Item({ item, onDecide }) {
  // null, 'back' (writing what to change) or 'posted' (adding the link)
  const [mode, setMode] = useState(null)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const { urls, files } = usePictures(item.images)

  const about = [
    KIND_LABEL[item.kind],
    item.place,
    item.game_slug && getGameName(item.game_slug),
    item.puzzle_date && fmtDayShort(item.puzzle_date),
    item.due_on && `due ${fmtDayShort(item.due_on)}`,
  ].filter(Boolean).join(' · ')

  async function decide(patch) {
    setSaving(true)
    const ok = await onDecide(item.id, patch)
    if (!ok) setSaving(false)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(item.body)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Nothing to do: the text is on screen to select by hand.
    }
  }

  async function sharePictures() {
    // Instagram takes the pictures but not the words, so the caption goes on
    // the clipboard too, ready to paste. Not awaited, so the share sheet still
    // opens straight from the tap.
    navigator.clipboard?.writeText(item.body).catch(() => {})
    try {
      await navigator.share({ files })
    } catch {
      // Closing the sheet lands here too. Nothing to show.
    }
  }

  return (
    <div style={{ padding: '1rem 0', borderTop: '1px solid var(--border)' }}>
      <p style={tagStyle}>{about}</p>
      <p style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500, margin: '4px 0 6px' }}>{item.title}</p>
      {item.body && (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {item.body}
        </p>
      )}
      {urls && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${urls.length}, 1fr)`, gap: '6px', marginTop: '10px', maxWidth: '420px' }}>
          {urls.map((url, i) => (
            <img
              key={url}
              src={url}
              alt={`Picture ${i + 1} of ${urls.length}`}
              style={{ display: 'block', width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', borderRadius: '8px', background: '#111' }}
            />
          ))}
        </div>
      )}
      {urls && !item.auto_post && isNativeApp() && (
        <p style={{ ...noteStyle, marginTop: '6px' }}>
          To post these yourself, open tempify.me/admin/bot in Safari, where you can share the pictures.
        </p>
      )}
      {item.note && (
        <p style={{ ...noteStyle, marginTop: '6px' }}>Your last note: {item.note}</p>
      )}

      {mode === 'back' && (
        <div style={{ marginTop: '0.75rem' }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="What should change?"
            rows={3}
            maxLength={1000}
            style={{ ...inputStyle, resize: 'vertical' }}
            autoFocus
          />
        </div>
      )}
      {mode === 'posted' && (
        <div style={{ marginTop: '0.75rem' }}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Link to the post (optional)"
            maxLength={500}
            inputMode="url"
            style={inputStyle}
            autoFocus
          />
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '0.75rem' }}>
        {mode === null && (
          <>
            {item.kind === 'post' && item.auto_post
              ? <button style={primaryStyle} className="btn-press" disabled={saving} onClick={() => decide({ status: 'approved' })}>Post it</button>
              : item.kind === 'post'
                ? <button style={primaryStyle} className="btn-press" onClick={() => { setText(''); setMode('posted') }}>Posted</button>
                : <button style={primaryStyle} className="btn-press" disabled={saving} onClick={() => decide({ status: 'approved' })}>Looks good</button>}
            <button style={buttonStyle} className="btn-press" onClick={() => { setText(''); setMode('back') }}>Send back</button>
            {files && !item.auto_post && (
              <button style={buttonStyle} className="btn-press" onClick={sharePictures}>Share pictures</button>
            )}
            {item.kind === 'post' && item.body && (
              <button style={buttonStyle} className="btn-press" onClick={copy}>{copied ? 'Copied' : 'Copy text'}</button>
            )}
          </>
        )}
        {mode === 'back' && (
          <>
            <button style={primaryStyle} className="btn-press" disabled={saving || !text.trim()}
              onClick={() => decide({ status: 'sent_back', note: text.trim() })}>
              Send back
            </button>
            <button style={buttonStyle} className="btn-press" onClick={() => setMode(null)}>Cancel</button>
          </>
        )}
        {mode === 'posted' && (
          <>
            <button style={primaryStyle} className="btn-press" disabled={saving}
              onClick={() => decide({ status: 'posted', link: text.trim() || null })}>
              Save
            </button>
            <button style={buttonStyle} className="btn-press" onClick={() => setMode(null)}>Cancel</button>
          </>
        )}
      </div>
    </div>
  )
}

export default function AdminBot() {
  const { user, loading } = useAuth()
  const adminEmails = (import.meta.env.VITE_ADMIN_EMAIL || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  const isAdmin = !loading && !!user && adminEmails.length && adminEmails.includes((user.email || '').trim().toLowerCase())

  const [items, setItems] = useState(null)
  const [log, setLog] = useState(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const [open, done] = await Promise.all([
      // Open items, and posts Jett told the bot to put up that it hasn't yet.
      supabase.from('agent_items').select('*')
        .or('status.in.(waiting,sent_back),and(status.eq.approved,auto_post.is.true)')
        .order('due_on', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true }),
      supabase.from('agent_log').select('*').order('at', { ascending: false }).limit(LOG_ROWS),
    ])
    if (open.error || done.error) {
      setMissing(true)
      return
    }
    setItems(open.data)
    setLog(done.data)
  }, [])

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin, load])

  async function decide(id, patch) {
    setError(null)
    const { error: err } = await supabase.from('agent_items')
      .update({ ...patch, decided_at: new Date().toISOString() })
      .eq('id', id)
    if (err) {
      setError("That didn't save. Check your connection and try again.")
      return false
    }
    setItems(list => list.map(i => (i.id === id ? { ...i, ...patch } : i)))
    return true
  }

  if (loading) return null
  if (!isAdmin) return <Navigate to="/" replace />

  const waiting = (items || []).filter(i => i.status === 'waiting')
  const sentBack = (items || []).filter(i => i.status === 'sent_back')
  const posting = (items || []).filter(i => i.status === 'approved' && i.auto_post)

  return (
    <div className="page-shell-admin">
      <Link to="/admin" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Back to puzzles</Link>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '1.25rem 0 0.35rem' }}>admin</p>
      <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
        Tempify bot
      </h1>

      {missing && (
        <p style={{ ...noteStyle, marginTop: '1rem' }}>
          The bot's list isn't there yet. It starts once migration 015 has run on the database.
        </p>
      )}
      {error && <p style={{ ...noteStyle, color: 'var(--red)', marginTop: '1rem' }}>{error}</p>}

      {items && (
        <section style={panelStyle}>
          <p style={titleStyle}>To look at{waiting.length ? ` (${waiting.length})` : ''}</p>
          {waiting.length === 0
            ? <p style={noteStyle}>Nothing right now. The bot's drafts and new puzzles show up here.</p>
            : waiting.map(item => <Item key={`${item.id}-${item.updated_at}`} item={item} onDecide={decide} />)}

          {posting.length > 0 && (
            <>
              <p style={{ ...tagStyle, marginTop: '1.25rem' }}>Posting soon</p>
              {posting.map(item => (
                <p key={item.id} style={{ ...noteStyle, marginTop: '4px' }}>
                  {item.title}: the bot posts it within 15 minutes.
                </p>
              ))}
            </>
          )}

          {sentBack.length > 0 && (
            <>
              <p style={{ ...tagStyle, marginTop: '1.25rem' }}>Sent back, waiting on the bot</p>
              {sentBack.map(item => (
                <p key={item.id} style={{ ...noteStyle, marginTop: '4px' }}>
                  {item.title}{item.note ? `: ${item.note}` : ''}
                </p>
              ))}
            </>
          )}
        </section>
      )}

      {log && (
        <section style={panelStyle}>
          <p style={titleStyle}>What the bot did</p>
          {log.length === 0
            ? <p style={noteStyle}>Nothing yet. Each thing the bot makes or changes is listed here.</p>
            : log.map(row => (
              <div key={row.id} style={{ display: 'flex', gap: '12px', padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: '13px' }}>
                <span style={{ ...tagStyle, flex: '0 0 auto', minWidth: '96px', paddingTop: '1px' }}>{fmtWhen(row.at)}</span>
                <span style={{ color: row.failed ? 'var(--red)' : 'var(--text-primary)', overflowWrap: 'anywhere' }}>
                  {row.failed ? 'Failed: ' : ''}{row.summary}
                </span>
              </div>
            ))}
        </section>
      )}

      <PlayCounts />
    </div>
  )
}
