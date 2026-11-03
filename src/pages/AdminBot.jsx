import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { fmtDayShort } from '../lib/date'
import { getGameName } from '../lib/games'
import { isNativeApp } from '../lib/oauth'
import { openExternalUrlInApp } from '../lib/inAppBrowser'
import {
  DEFAULT_POST_AT, asksJett, backWhen, dayOf, goesUpWhen, handBackOf, isBotPost, isWithBot, jettsNote,
  lineKind, needsJett, rowWhen, sendBackWarning, songOf, stageOf, summarize, swappedFrom,
} from '../lib/botStage'
import Icon from '../components/Icon'
import { PlayCounts } from './AdminPlayers'

// The Tempify bot's side of Admin, on one screen for the phone: what needs
// Jett, what the bot has, what went up, what it did, and the play counts. The
// tables are migrations 014, 015, 017 and 018; the bot's prompt (in Drive) says
// how it fills them.
//
// Jett approves every post. "Approve to post" hands a chart fact to the bot,
// which makes it on his second iPhone and shares it on its day
// (scripts/chart-card/README.md, "Posting it"). Any other post he puts up
// himself, so its answer is "Posted". Games are the bot's to approve: they're
// live either way, so they never wait here, and one that needs a fix gets it
// on Admin's puzzle schedule.
//
// The job on the Mac moves rows every minute, so the page checks again while
// it's open. lib/botStage.js reads where a card has got to.

const LOG_ROWS = 40
const RECENT_POSTS = 7
const CHECK_EVERY_MS = 30000
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
const tagStyle = { fontSize: '11px', color: 'var(--text-muted)' }
const cardTitleStyle = { fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500, margin: '4px 0 6px' }
const cardStyle = { padding: '1rem 0', borderTop: '1px solid var(--border)' }
const captionStyle = { fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }

const buttonStyle = {
  padding: '9px 16px', borderRadius: '999px', fontSize: '13px', cursor: 'pointer',
  border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)',
}
const primaryStyle = { ...buttonStyle, background: 'var(--text-primary)', color: 'var(--bg)', border: '1px solid var(--text-primary)' }

const pillStyle = {
  display: 'inline-flex', alignItems: 'center', gap: '5px', marginBottom: '6px',
  padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 500,
  color: 'var(--amber)', background: 'var(--amber-glow)', border: '1px solid rgba(245, 158, 11, 0.4)',
}
const redPillStyle = { ...pillStyle, color: '#fca5a5', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)' }

const buttonRowStyle = { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '0.75rem' }

// The dot on a card's row. Each stage differs in shape as well as color, so
// they stay apart at a glance.
const DOT_STYLES = {
  ready: { background: 'var(--green)' },
  wait: { background: 'var(--amber)' },
  line: { background: 'transparent', border: '1.5px solid var(--text-muted)' },
  work: { background: 'var(--text-primary)', animation: 'dotPulse 1.8s ease-in-out infinite' },
  plain: { background: 'var(--text-muted)' },
}

const STEPS = ['Approved', 'Draft', 'Share', 'Live']

const KIND_LABEL = { post: 'Post', puzzle: 'Puzzle', note: 'Note' }

const isVideo = path => /\.mp4$/i.test(path)
const isWebLink = link => /^https?:\/\//i.test(link || '')

function fmtWhen(iso) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function fmtChecked(date) {
  return date.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
}

// A post's pictures and Reel from the bot's private bucket, once load says
// they're wanted, and the same as files for the share sheet when share does:
// the Reel when there is one, since that's what gets posted, or else the
// pictures. The files are fetched as soon as the links arrive, because Safari
// only opens the share sheet straight from a tap, with nothing to wait on in
// between. A whole Reel is a lot to fetch, so only ask for it where there's a
// share button to use it.
//
// version is what says a card was made again: the Reel keeps its path, so
// without it the page would go on playing the old one.
function usePictures(paths, { load = true, share = false, version = '' } = {}) {
  const [media, setMedia] = useState(null)
  const [files, setFiles] = useState(null)
  const [round, setRound] = useState(0)
  const signedAt = useRef(0)
  const key = (paths || []).join('|')

  useEffect(() => {
    if (!key || !load) return
    let live = true
    const list = key.split('|')
    supabase.storage.from('agent').createSignedUrls(list, PICTURE_LINK_SECONDS).then(async ({ data, error }) => {
      if (!live || error || !data) return
      signedAt.current = Date.now()
      const signed = data.filter(d => d.signedUrl).map(d => ({ path: d.path, url: d.signedUrl, video: isVideo(d.path) }))
      setMedia(signed)
      if (!share || isNativeApp() || !navigator.canShare) return
      const toShare = signed.some(m => m.video) ? signed.filter(m => m.video) : signed
      try {
        const made = await Promise.all(toShare.map(async (m, i) => {
          const res = await fetch(m.url)
          if (!res.ok) throw new Error(`file ${i + 1}: ${res.status}`)
          const blob = await res.blob()
          return new File([blob], m.path.split('/').slice(-2).join('-'), { type: blob.type || (m.video ? 'video/mp4' : 'image/jpeg') })
        }))
        if (live && navigator.canShare({ files: made })) setFiles(made)
      } catch {
        // No share button then. The pictures still show.
      }
    })
    return () => { live = false }
  }, [key, load, share, version, round])

  // The links last an hour and the page can stay open for longer, so a Reel
  // that won't play gets a new one. Only an old link, or a Reel that's really
  // gone would ask for links forever.
  const renew = useCallback(() => {
    if (Date.now() - signedAt.current > (PICTURE_LINK_SECONDS - 600) * 1000) setRound(r => r + 1)
  }, [])

  return { media, files, renew }
}

const versionOf = item => `${item.status}|${item.body}`

function Song({ song }) {
  return (
    <p style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
      <Icon name="disc" size={12} />
      <span>{song}</span>
    </p>
  )
}

// The Reel on the left and the words beside it, so the buttons under them stay
// in reach of a thumb. The Reel here never has the song: that only ever goes
// on from Instagram's music, on the phone.
function ReelAndWords({ videos, onBroken, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'clamp(120px, 34%, 200px) minmax(0, 1fr)', gap: '12px', marginTop: '8px', alignItems: 'start' }}>
      <div>
        {videos.map(m => (
          <video
            key={m.url}
            src={m.url}
            controls
            playsInline
            preload="metadata"
            aria-label="The Reel"
            onError={onBroken}
            style={{ display: 'block', width: '100%', aspectRatio: '9 / 16', borderRadius: '8px', background: '#111' }}
          />
        ))}
        <p style={{ ...tagStyle, marginTop: '4px', textAlign: 'center' }}>No song here. The phone adds it.</p>
      </div>
      <div style={{ display: 'grid', gap: '8px', minWidth: 0 }}>{children}</div>
    </div>
  )
}

function Pictures({ pictures }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${pictures.length}, 1fr)`, gap: '6px', marginTop: '10px', maxWidth: '420px' }}>
      {pictures.map((m, i) => (
        <img
          key={m.url}
          src={m.url}
          alt={`Picture ${i + 1} of ${pictures.length}`}
          style={{ display: 'block', width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', borderRadius: '8px', background: '#111' }}
        />
      ))}
    </div>
  )
}

// The spare pictures of a post with a Reel. Nothing posts them now, so they
// wait behind a tap and leave the card short.
function SparePictures({ pictures }) {
  const [open, setOpen] = useState(false)
  if (pictures.length === 0) return null
  return (
    <>
      <button
        className="btn-press tap-target"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{ ...tagStyle, background: 'none', border: 0, padding: 0, marginTop: '8px', cursor: 'pointer', textDecoration: 'underline' }}
      >
        {open ? 'Hide the pictures' : `Show the pictures (${pictures.length})`}
      </button>
      {open && <Pictures pictures={pictures} />}
    </>
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Nothing to do: the text is on screen to select by hand.
    }
  }

  return <button style={buttonStyle} className="btn-press" onClick={copy}>{copied ? 'Copied' : 'Copy text'}</button>
}

function ShareButton({ files, text, label }) {
  async function share() {
    // Instagram takes the pictures but not the words, so the caption goes on
    // the clipboard too, ready to paste. Not awaited, so the share sheet still
    // opens straight from the tap.
    navigator.clipboard?.writeText(text).catch(() => {})
    try {
      await navigator.share({ files })
    } catch {
      // Closing the sheet lands here too. Nothing to show.
    }
  }

  return <button style={buttonStyle} className="btn-press" onClick={share}>{label}</button>
}

// The buttons under a card and the box each one opens. approve is the label of
// a button that says yes; posted, back and skip turn the others on; children
// are any more buttons to add. A save the page turns down keeps what was typed.
function Answer({ item, approve, posted, back, skip, warning, onDecide, children }) {
  // null, 'back' (writing what to change), 'posted' (adding the link) or
  // 'skip' (making sure)
  const [mode, setMode] = useState(null)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState(null)

  // The job can move a card on while the box is open.
  const shown = mode === 'back' && !back ? null : mode

  function open(next) {
    setText('')
    setProblem(null)
    setMode(next)
  }

  async function decide(patch) {
    setSaving(true)
    setProblem(null)
    const trouble = await onDecide(item, patch)
    setSaving(false)
    setProblem(trouble)
  }

  return (
    <>
      {shown === 'back' && (
        <div style={{ marginTop: '0.75rem' }}>
          {warning && <p style={{ ...noteStyle, color: 'var(--amber)', marginBottom: '6px' }}>{warning}</p>}
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
      {shown === 'posted' && (
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
      {shown === 'skip' && (
        <p style={{ ...noteStyle, marginTop: '0.75rem' }}>Skip this one? It leaves this list and nothing goes up. Any draft stays in Reels drafts.</p>
      )}

      <div style={buttonRowStyle}>
        {shown === null && (
          <>
            {approve && <button style={primaryStyle} className="btn-press" disabled={saving} onClick={() => decide({ status: 'approved' })}>{approve}</button>}
            {posted && <button style={primaryStyle} className="btn-press" onClick={() => open('posted')}>Posted</button>}
            {back && <button style={buttonStyle} className="btn-press" onClick={() => open('back')}>Send back</button>}
            {skip && <button style={approve || posted ? buttonStyle : primaryStyle} className="btn-press" onClick={() => open('skip')}>Skip it</button>}
            {children}
          </>
        )}
        {shown === 'back' && (
          <>
            <button style={primaryStyle} className="btn-press" disabled={saving || !text.trim()}
              onClick={() => decide({ status: 'sent_back', note: text.trim() })}>
              Send back
            </button>
            <button style={buttonStyle} className="btn-press" onClick={() => setMode(null)}>Cancel</button>
          </>
        )}
        {shown === 'posted' && (
          <>
            {/* auto_post off is how the bot's dashboard knows Jett put it up,
                and what gets it into "What the bot did". */}
            <button style={primaryStyle} className="btn-press" disabled={saving}
              onClick={() => decide({ status: 'posted', link: text.trim() || null, auto_post: false })}>
              Save
            </button>
            <button style={buttonStyle} className="btn-press" onClick={() => setMode(null)}>Cancel</button>
          </>
        )}
        {shown === 'skip' && (
          <>
            {/* The bot only takes approved rows with auto_post on, so this
                ends the row without a status of its own. */}
            <button style={primaryStyle} className="btn-press" disabled={saving}
              onClick={() => decide({ status: 'approved', auto_post: false })}>
              Skip it
            </button>
            <button style={buttonStyle} className="btn-press" onClick={() => setMode(null)}>Cancel</button>
          </>
        )}
      </div>
      {problem && <p style={{ ...noteStyle, color: 'var(--red)', marginTop: '8px' }}>{problem}</p>}
    </>
  )
}

// One thing to look at: a chart fact to approve, a post Jett puts up himself,
// or a note.
function Item({ item, postAt, onDecide }) {
  const chartFact = isBotPost(item)
  const { media, files, renew } = usePictures(item.images, { share: !chartFact, version: versionOf(item) })
  const videos = (media || []).filter(m => m.video)
  const pictures = (media || []).filter(m => !m.video)
  const was = swappedFrom(item)
  const song = chartFact && songOf(item)

  const about = chartFact
    ? `Reel for Instagram · ${dayOf(item)}`
    : [
      KIND_LABEL[item.kind],
      item.place,
      item.game_slug && getGameName(item.game_slug),
      item.puzzle_date && fmtDayShort(item.puzzle_date),
      item.due_on && `due ${fmtDayShort(item.due_on)}`,
    ].filter(Boolean).join(' · ')

  const words = (
    <>
      {was && <p style={noteStyle}>Instagram's music doesn't have “{was}”, so the Reel was made again.</p>}
      {song && <Song song={song} />}
      {item.body && <p style={captionStyle}>{item.body}</p>}
    </>
  )

  return (
    <div style={cardStyle}>
      {was && <p style={pillStyle}><Icon name="disc" size={12} />Song changed</p>}
      <p style={tagStyle}>{about}</p>
      <p style={cardTitleStyle}>{item.title}</p>
      {videos.length > 0
        ? <ReelAndWords videos={videos} onBroken={renew}>{words}</ReelAndWords>
        : words}
      {videos.length > 0
        ? <SparePictures pictures={pictures} />
        : pictures.length > 0 && <Pictures pictures={pictures} />}
      {/* A chart fact's card already says what the job's known lines say. A
          hand-back line here is left over from a by-hand remake: the card is
          back to be approved, so it's out of date. */}
      {item.bot_note && (!chartFact || lineKind(item.bot_note) === 'unknown') && (
        <p style={{ ...noteStyle, marginTop: '6px' }}>{item.bot_note}</p>
      )}
      {media && !chartFact && isNativeApp() && (
        <p style={{ ...noteStyle, marginTop: '6px' }}>
          To post these yourself, open tempify.me/admin/bot in Safari, where you can share the pictures.
        </p>
      )}
      {jettsNote(item) && <p style={{ ...noteStyle, marginTop: '6px' }}>Your last note: {item.note}</p>}

      <Answer
        item={item}
        approve={chartFact ? (was ? 'Approve again' : 'Approve to post') : item.kind !== 'post' && 'Looks good'}
        posted={!chartFact && item.kind === 'post'}
        back
        warning={sendBackWarning(item, postAt)}
        onDecide={onDecide}
      >
        {files && !chartFact && (
          <ShareButton files={files} text={item.body} label={videos.length ? 'Share the Reel' : 'Share pictures'} />
        )}
        {item.kind === 'post' && item.body && <CopyButton text={item.body} />}
      </Answer>
      {chartFact && (
        <p style={{ ...noteStyle, marginTop: '8px' }}>
          Approve it and the phone makes the draft right away. It goes up {goesUpWhen(item, postAt)}.
        </p>
      )}
    </div>
  )
}

// A chart fact that can't go any further without Jett. handBackOf says why and
// what's left to do, which depends on the line: some cards shouldn't be posted
// at all, so those don't offer Posted or anything to post from.
function NeedsYou({ item, postAt, onDecide }) {
  const [showing, setShowing] = useState(false)
  const { media, files, renew } = usePictures(item.images, { load: showing, share: showing, version: versionOf(item) })
  const videos = (media || []).filter(m => m.video)
  const pictures = (media || []).filter(m => !m.video)
  const handBack = handBackOf(item)

  return (
    <div style={cardStyle}>
      <p style={redPillStyle}><Icon name="alert" size={12} />{handBack.pill}</p>
      <p style={tagStyle}>Reel for Instagram · {dayOf(item)}</p>
      <p style={cardTitleStyle}>{item.title}</p>
      <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{handBack.reason}</p>
      <p style={{ ...noteStyle, color: 'var(--text-primary)', marginTop: '8px', padding: '10px 12px', background: 'rgba(0, 0, 0, 0.18)', borderRadius: '8px' }}>
        {handBack.todo}
      </p>
      {jettsNote(item) && <p style={{ ...noteStyle, marginTop: '6px' }}>Your last note: {item.note}</p>}
      {videos.length > 0 && <ReelAndWords videos={videos} onBroken={renew}><p style={captionStyle}>{item.body}</p></ReelAndWords>}
      {videos.length === 0 && pictures.length > 0 && <Pictures pictures={pictures} />}

      <Answer item={item} posted={handBack.posted} back={handBack.back} skip={handBack.skip} warning={sendBackWarning(item, postAt)} onDecide={onDecide}>
        {handBack.media && !showing && item.images?.length > 0 && (
          <button style={buttonStyle} className="btn-press" onClick={() => setShowing(true)}>
            {item.images.some(isVideo) ? 'Show the Reel' : 'Show the pictures'}
          </button>
        )}
        {handBack.media && files && <ShareButton files={files} text={item.body} label={videos.length ? 'Share the Reel, no song' : 'Share pictures'} />}
        {handBack.media && item.body && <CopyButton text={item.body} />}
      </Answer>
    </div>
  )
}

function Steps({ stage }) {
  if (stage.step === null) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STEPS.length}, 1fr)`, gap: '4px' }}>
      {STEPS.map((name, i) => {
        const now = i === stage.step
        const color = now ? (stage.stuck ? 'var(--amber)' : 'var(--text-primary)') : i < stage.step ? 'var(--green)' : 'var(--border)'
        return (
          <div key={name} aria-current={now ? 'step' : undefined}>
            <div style={{ height: '3px', borderRadius: '2px', background: color }} />
            <p style={{ fontSize: '10px', marginTop: '4px', fontWeight: now ? 500 : 400, color: now ? color : 'var(--text-muted)' }}>{name}</p>
          </div>
        )
      })}
    </div>
  )
}

// A card the bot has, as one short row, since a week of them is normal. Its
// Reel only loads once it's opened.
function BotRow({ item, postAt, onDecide }) {
  const [open, setOpen] = useState(false)
  const { media, renew } = usePictures(item.images, { load: open, version: versionOf(item) })
  const videos = (media || []).filter(m => m.video)
  const stage = stageOf(item, postAt)
  const song = songOf(item)

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          display: 'grid', gridTemplateColumns: '12px minmax(0, 1fr) auto', gap: '10px', alignItems: 'center',
          width: '100%', minHeight: '44px', padding: '11px 0', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ width: '9px', height: '9px', borderRadius: '50%', ...DOT_STYLES[stage.dot] }} />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
            {dayOf(item)}{' '}
            <span style={{ fontWeight: 400, color: stage.stuck ? 'var(--amber)' : 'var(--text-muted)' }}>{stage.label}</span>
          </span>
          {song && <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{song}</span>}
        </span>
        <span style={{ ...tagStyle, display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          {rowWhen(item, stage, postAt)}
          <span style={{ display: 'inline-flex', rotate: open ? '90deg' : '0deg', transition: 'rotate 0.18s ease' }}><Icon name="chevronRight" size={11} /></span>
        </span>
      </button>

      {open && (
        <div style={{ padding: '2px 0 14px' }}>
          <Steps stage={stage} />
          {videos.length > 0
            ? <ReelAndWords videos={videos} onBroken={renew}><p style={captionStyle}>{item.body}</p></ReelAndWords>
            : <p style={{ ...captionStyle, marginTop: '10px' }}>{item.body}</p>}
          {item.bot_note && lineKind(item.bot_note) !== 'handed-back' && (
            <p style={{ ...noteStyle, marginTop: '8px', overflowWrap: 'anywhere' }}>Bot: {item.bot_note}</p>
          )}
          {stage.sendBack
            ? <Answer item={item} back warning={sendBackWarning(item, postAt)} onDecide={onDecide} />
            : (
              <p style={{ ...noteStyle, marginTop: '8px' }}>
                {stage.key === 'unknown'
                  ? "Send back is off because the page doesn't know this line yet."
                  : "It may be going up now, so it can't be sent back."}
              </p>
            )}
        </div>
      )}
    </div>
  )
}

// The one thing to know right now, before any of the lists.
function Summary({ summary }) {
  const { warn, title, detail, todo } = summary
  return (
    <section style={{
      display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr)', gap: '10px', marginTop: '1rem', padding: '12px 14px', borderRadius: '10px',
      background: warn ? 'var(--amber-glow)' : 'var(--surface)',
      border: `1px solid ${warn ? 'rgba(245, 158, 11, 0.4)' : 'var(--border)'}`,
    }}>
      <span style={{ marginTop: '2px', color: warn ? 'var(--amber)' : 'var(--green)' }}>
        <Icon name={warn ? 'alert' : 'check'} size={16} />
      </span>
      <div>
        <p style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>{title}</p>
        {detail && <p style={noteStyle}>{detail}</p>}
        {todo && <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5, marginTop: '6px' }}>{todo}</p>}
      </div>
    </section>
  )
}

function RecentPost({ item }) {
  const link = isWebLink(item.link) ? item.link : null

  function open(e) {
    // The app's web view can't open a new tab itself.
    if (!isNativeApp()) return
    e.preventDefault()
    openExternalUrlInApp(link)
  }

  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
        <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
          {item.due_on ? fmtDayShort(item.due_on) : fmtWhen(item.updated_at)}
        </p>
        {link
          ? <a href={link} target="_blank" rel="noreferrer" onClick={open} style={{ ...noteStyle, color: 'var(--amber-light)', whiteSpace: 'nowrap' }}>Open on Instagram</a>
          : <span style={{ ...tagStyle, whiteSpace: 'nowrap' }}>No link saved</span>}
      </div>
      <p style={{ ...noteStyle, overflowWrap: 'anywhere' }}>{songOf(item) || item.title}</p>
    </div>
  )
}

// When the bot shares approved chart facts, for all of them.
function PostingTime({ postAt, onSave }) {
  const [draft, setDraft] = useState(postAt || DEFAULT_POST_AT)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  if (postAt === false) {
    return (
      <section style={panelStyle}>
        <p style={titleStyle}>Posting time</p>
        <p style={noteStyle}>
          The bot posts at 9 AM Eastern for now. You can change the time here once migration 017 has run, which happens when the site is next pushed.
        </p>
      </section>
    )
  }

  async function save() {
    setSaving(true)
    const ok = await onSave(draft)
    setSaving(false)
    if (ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <section style={panelStyle}>
      <p style={titleStyle}>Posting time</p>
      <p style={noteStyle}>
        Every approved chart fact goes up at this time on its day, Eastern. A new time counts for anything not shared yet. Never before its day, since a post gives away the day before's puzzle.
      </p>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '0.75rem' }}>
        <input
          type="time"
          step="300"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          aria-label="Posting time, Eastern"
          style={{ ...inputStyle, width: 'auto' }}
        />
        <button style={primaryStyle} className="btn-press" disabled={saving || !draft || draft === postAt} onClick={save}>
          {saved ? 'Saved' : 'Save time'}
        </button>
      </div>
    </section>
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
  const [recent, setRecent] = useState(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState(null)
  // null until it loads; false when the table isn't there yet (migration 017)
  const [postAt, setPostAt] = useState(null)
  const [checkedAt, setCheckedAt] = useState(null)
  const [missedCheck, setMissedCheck] = useState(false)

  // Goes up with every check and every save, so an answer can tell it's out of
  // date: a check that left before a tap would put the card back how it was.
  const turn = useRef(0)
  const loaded = useRef(false)

  const load = useCallback(async () => {
    const mine = ++turn.current
    const [open, done, shared] = await Promise.all([
      // Open items, and posts Jett told the bot to put up that it hasn't yet.
      supabase.from('agent_items').select('*')
        .or('status.in.(waiting,sent_back),and(status.eq.approved,auto_post.is.true)')
        .order('due_on', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true }),
      supabase.from('agent_log').select('*').order('at', { ascending: false }).limit(LOG_ROWS),
      supabase.from('agent_items').select('*').eq('status', 'posted')
        .order('updated_at', { ascending: false }).limit(RECENT_POSTS),
    ])
    const settings = await supabase.from('agent_settings').select('post_at').limit(1)
    if (mine !== turn.current) return
    if (open.error || done.error || shared.error) {
      // The first load failing means the tables aren't there. After that it's
      // one missed check, and what's on screen is still worth keeping.
      if (loaded.current) setMissedCheck(true)
      else setMissing(true)
      return
    }
    loaded.current = true
    setMissing(false)
    setMissedCheck(false)
    setItems(open.data)
    setLog(done.data)
    setRecent(shared.data)
    setPostAt(settings.error ? false : (settings.data?.[0]?.post_at || DEFAULT_POST_AT).slice(0, 5))
    setCheckedAt(new Date())
  }, [])

  useEffect(() => {
    if (!isAdmin) return undefined
    load()
    const check = () => { if (!document.hidden) load() }
    const timer = setInterval(check, CHECK_EVERY_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [isAdmin, load])

  // Saves an answer only if the row is still what's on screen, and says what
  // went wrong if it didn't save. The job changes rows while the page is open,
  // so a card on screen can be out of date: the song swapped for one Jett
  // hasn't heard, or a share already under way.
  async function decide(item, patch) {
    turn.current += 1
    const update = supabase.from('agent_items')
      .update({ ...patch, decided_at: new Date().toISOString() })
      .eq('id', item.id)
      .eq('status', item.status)
    const { data, error: err } = await (item.bot_note == null ? update.is('bot_note', null) : update.eq('bot_note', item.bot_note)).select('id')
    if (err) return "That didn't save. Check your connection and try again."
    if (!data?.length) {
      await load()
      return "This card just changed, so that didn't save. Look it over and try again."
    }
    setItems(list => list.map(i => (i.id === item.id ? { ...i, ...patch } : i)))
    load()
    return null
  }

  if (loading) return null
  if (!isAdmin) return <Navigate to="/" replace />

  async function saveTime(time) {
    setError(null)
    turn.current += 1
    const { error: err } = await supabase.from('agent_settings')
      .update({ post_at: time, updated_at: new Date().toISOString() })
      .eq('id', true)
    if (err) {
      setError("The posting time didn't save. Check your connection and try again.")
      return false
    }
    setPostAt(time)
    return true
  }

  const shownTime = postAt || DEFAULT_POST_AT
  const list = items || []
  const needsYou = list.filter(needsJett)
  const toLookAt = list.filter(i => asksJett(i) && !needsJett(i))
  // A card made again with a new song comes first: it's the one that changed.
  const swapped = toLookAt.filter(i => swappedFrom(i))
  const rest = toLookAt.filter(i => !swappedFrom(i))
  const withBot = list.filter(isWithBot)
  const sentBack = list.filter(i => i.status === 'sent_back' && !needsJett(i))

  return (
    <div className="page-shell-admin">
      <Link to="/admin" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Back to puzzles</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px' }}>
        <div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '1.25rem 0 0.35rem' }}>admin</p>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Tempify bot
          </h1>
        </div>
        {checkedAt && (
          <span style={{ ...tagStyle, display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: missedCheck ? 'var(--amber)' : 'var(--green)' }} />
            Checked {fmtChecked(checkedAt)}
          </span>
        )}
      </div>

      {missing && (
        <p style={{ ...noteStyle, marginTop: '1rem' }}>
          The bot's list isn't there yet. It starts once migration 015 has run on the database.
        </p>
      )}
      {missedCheck && items && (
        <p style={{ ...noteStyle, color: 'var(--amber)', marginTop: '1rem' }}>
          Couldn't check just now, so this may be out of date. It keeps trying. If it stays like this, check your connection.
        </p>
      )}
      {error && <p style={{ ...noteStyle, color: 'var(--red)', marginTop: '1rem' }}>{error}</p>}

      {items && <Summary summary={summarize(list, shownTime)} />}

      {needsYou.length > 0 && (
        <section style={{ ...panelStyle, background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
          <p style={titleStyle}>Needs you ({needsYou.length})</p>
          {needsYou.map(item => <NeedsYou key={item.id} item={item} postAt={shownTime} onDecide={decide} />)}
        </section>
      )}

      {items && (
        <section style={panelStyle}>
          <p style={titleStyle}>To look at{toLookAt.length ? ` (${toLookAt.length})` : ''}</p>
          {toLookAt.length === 0
            ? <p style={noteStyle}>Nothing right now. New chart facts show up here after the 7 AM run.</p>
            : [...swapped, ...rest].map(item => <Item key={item.id} item={item} postAt={shownTime} onDecide={decide} />)}
        </section>
      )}

      {withBot.length > 0 && (
        <section style={panelStyle}>
          <p style={titleStyle}>The bot has these ({withBot.length})</p>
          <div style={{ marginTop: '0.5rem' }}>
            {withBot.map(item => <BotRow key={item.id} item={item} postAt={shownTime} onDecide={decide} />)}
          </div>
        </section>
      )}

      {sentBack.length > 0 && (
        <section style={panelStyle}>
          <p style={titleStyle}>Sent back ({sentBack.length})</p>
          <p style={noteStyle}>The 7 AM run makes these again, then they come back here to approve.</p>
          <div style={{ marginTop: '0.5rem' }}>
            {sentBack.map(item => (
              <div key={item.id} style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{item.due_on ? dayOf(item) : item.title}</p>
                  <span style={tagStyle}>{backWhen()}</span>
                </div>
                {item.note && <p style={{ ...noteStyle, overflowWrap: 'anywhere' }}>Your note: {item.note}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {recent?.length > 0 && (
        <section style={panelStyle}>
          <p style={titleStyle}>Recent posts</p>
          <div style={{ marginTop: '0.5rem' }}>
            {recent.map(item => <RecentPost key={item.id} item={item} />)}
          </div>
        </section>
      )}

      {items && postAt !== null && <PostingTime postAt={postAt} onSave={saveTime} />}

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
