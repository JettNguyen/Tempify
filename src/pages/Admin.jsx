import { useState, useEffect, useCallback, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { GENRES } from '../lib/genres'
import { searchSongs } from '../lib/itunes'
import { searchRecordings } from '../lib/musicbrainz'
import { lookupBillboardPeak, lookupBillboard200Peak } from '../lib/billboard'
import { todayEST } from '../lib/date'

const GAMES = [
  { slug: 'one-bar',        short: 'One Bar' },
  { slug: 'hit-or-miss',    short: 'Hit or Miss' },
  { slug: 'sampled',        short: 'Sampled' },
  { slug: 'era',            short: 'Era' },
  { slug: 'cover-or-not',   short: 'Cover/Not' },
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
  // hit-or-miss
  verdict: 'hit', peakPosition: '1', weeksAtOne: '', hint: '',
  // sampled
  sourceSong: '', sourceArtist: '', sourceYear: '', sourceArtworkUrl: '', sourceItunesUrl: '',
  sampleArtist: '', sampleYear: '', sampleAudioUrl: '', sampleArtworkUrl: '', correctArtist: '', correctItunesUrl: '',
  opt2Title: '', opt2Artist: '', opt2AudioUrl: '', opt2ArtworkUrl: '', opt2ItunesUrl: '',
  opt3Title: '', opt3Artist: '', opt3AudioUrl: '', opt3ArtworkUrl: '', opt3ItunesUrl: '',
  opt4Title: '', opt4Artist: '', opt4AudioUrl: '', opt4ArtworkUrl: '', opt4ItunesUrl: '',
  // era
  songTitle: '',
  // cover-or-not
  coverSongTitle: '', coverSongArtist: '', coverSongYear: '',
  isCover: 'cover',
  originalTitle: '', originalArtist: '', originalYear: '', originalAudio: '',
}

function parseRow(p) {
  const m = p.metadata || {}
  return {
    date:          p.scheduled_date,
    game:          p.game_slug,
    audioUrl:      p.audio_url || '',
    answer:        p.answer || '',
    genre:         p.genre || '',
    artist:        m.artist || '',
    year:          m.year ? String(m.year) : '',
    // hit-or-miss
    verdict:       m.verdict || 'hit',
    peakPosition:  m.peak_position ? String(m.peak_position) : '1',
    weeksAtOne:    m.weeks_at_one ? String(m.weeks_at_one) : '',
    hint:          m.hint || '',
    // sampled
    sourceSong:    m.source_song || '',
    sourceArtist:  m.source_artist || '',
    sourceYear:    m.source_year ? String(m.source_year) : '',
    sourceArtworkUrl: m.source_artwork_url || '',
    sourceItunesUrl:  m.source_itunes_url || '',
    sampleArtist:   m.sample_artist || '',
    sampleYear:     m.sample_year ? String(m.sample_year) : '',
    sampleAudioUrl: m.sample_audio_url || '',
    sampleArtworkUrl: m.sample_artwork_url || m.options?.[0]?.artwork_url || '',
    correctArtist:  m.options?.[0]?.artist || '',
    correctItunesUrl: m.options?.[0]?.itunes_url || '',
    opt2Title:     m.options?.[1]?.title || '',
    opt2Artist:    m.options?.[1]?.artist || '',
    opt2AudioUrl:  m.options?.[1]?.audio_url || '',
    opt2ArtworkUrl: m.options?.[1]?.artwork_url || '',
    opt2ItunesUrl: m.options?.[1]?.itunes_url || '',
    opt3Title:     m.options?.[2]?.title || '',
    opt3Artist:    m.options?.[2]?.artist || '',
    opt3AudioUrl:  m.options?.[2]?.audio_url || '',
    opt3ArtworkUrl: m.options?.[2]?.artwork_url || '',
    opt3ItunesUrl: m.options?.[2]?.itunes_url || '',
    opt4Title:     m.options?.[3]?.title || '',
    opt4Artist:    m.options?.[3]?.artist || '',
    opt4AudioUrl:  m.options?.[3]?.audio_url || '',
    opt4ArtworkUrl: m.options?.[3]?.artwork_url || '',
    opt4ItunesUrl: m.options?.[3]?.itunes_url || '',
    // era
    songTitle:     m.title || '',
    // cover-or-not
    coverSongTitle:  m.song_title || '',
    coverSongArtist: m.song_artist || '',
    coverSongYear:   m.song_year ? String(m.song_year) : '',
    isCover:         p.answer || 'cover',
    originalTitle:   m.original_title || '',
    originalArtist:  m.original_artist || '',
    originalYear:    m.original_year ? String(m.original_year) : '',
    originalAudio:   m.original_audio_url || '',
  }
}

function buildRow(f) {
  let meta = {}
  let audioUrl = f.audioUrl
  let answer = f.answer

  switch (f.game) {
    case 'one-bar':
      meta = { artist: f.artist, year: Number(f.year) }
      break
    case 'hit-or-miss':
      meta = {
        artist: f.artist, year: Number(f.year),
        verdict: f.verdict,
        peak_position: f.verdict === 'hit' ? Number(f.peakPosition) || 0 : 0,
        weeks_at_one: Number(f.weeksAtOne) || 0,
        hint: f.hint || null,
      }
      break
    case 'sampled':
      meta = {
        sample_artist: f.sampleArtist, sample_year: Number(f.sampleYear),
        sample_audio_url: f.sampleAudioUrl || null,
        sample_artwork_url: f.sampleArtworkUrl || null,
        source_song: f.sourceSong, source_artist: f.sourceArtist,
        source_year: Number(f.sourceYear),
        source_artwork_url: f.sourceArtworkUrl || null,
        source_itunes_url: f.sourceItunesUrl || null,
        options: [
          { title: f.answer,    artist: f.correctArtist, audio_url: f.sampleAudioUrl || null, artwork_url: f.sampleArtworkUrl || null, itunes_url: f.correctItunesUrl || null },
          { title: f.opt2Title, artist: f.opt2Artist, audio_url: f.opt2AudioUrl || null, artwork_url: f.opt2ArtworkUrl || null, itunes_url: f.opt2ItunesUrl || null },
          { title: f.opt3Title, artist: f.opt3Artist, audio_url: f.opt3AudioUrl || null, artwork_url: f.opt3ArtworkUrl || null, itunes_url: f.opt3ItunesUrl || null },
          { title: f.opt4Title, artist: f.opt4Artist, audio_url: f.opt4AudioUrl || null, artwork_url: f.opt4ArtworkUrl || null, itunes_url: f.opt4ItunesUrl || null },
        ],
      }
      break
    case 'era':
      answer = f.answer // decade string like "90s"
      meta = { title: f.songTitle, artist: f.artist, year: Number(f.year), decade: f.answer }
      break
    case 'cover-or-not':
      answer = f.isCover
      audioUrl = f.audioUrl
      meta = {
        song_title:  f.coverSongTitle,
        song_artist: f.coverSongArtist,
        song_year:   f.coverSongYear ? Number(f.coverSongYear) : null,
        ...(f.isCover === 'cover' ? {
          original_title:     f.originalTitle,
          original_artist:    f.originalArtist,
          original_year:      f.originalYear ? Number(f.originalYear) : null,
          original_audio_url: f.originalAudio || null,
        } : {}),
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

function HitOrMissFields({ f, set }) {
  const [bbStatus, setBbStatus] = useState(null) // null | 'hot100' | 'bb200' | 'miss'
  const [bb200Peak, setBb200Peak] = useState(null)
  const lastLookup = useRef('')

  useEffect(() => {
    const key = `${f.answer}|||${f.artist}`
    if (!f.answer || !f.artist || key === lastLookup.current) return
    lastLookup.current = key
    setBb200Peak(null)

    lookupBillboardPeak(f.answer, f.artist).then(async result => {
      if (result) {
        set('verdict', 'hit')
        set('peakPosition', String(result.peak))
        set('weeksAtOne', String(result.weeksAtOne))
        setBbStatus('hot100')
      } else {
        set('verdict', 'miss')
        set('peakPosition', '0')
        set('weeksAtOne', '0')
        const result200 = await lookupBillboard200Peak(f.answer, f.artist)
        if (result200) {
          setBb200Peak(result200)
          setBbStatus('bb200')
        } else {
          setBbStatus('miss')
        }
      }
    })
  }, [f.answer, f.artist])

  let statusMsg = null
  if (bbStatus === 'hot100') {
    statusMsg = { text: `Hot 100 — peak #${f.peakPosition}${Number(f.weeksAtOne) > 0 ? `, ${f.weeksAtOne}w at #1` : ''} (edit below if wrong)`, color: 'var(--green)' }
  } else if (bbStatus === 'bb200') {
    statusMsg = { text: `Not on Hot 100 — album peaked #${bb200Peak.peak} on Billboard 200${bb200Peak.weeksAtOne > 0 ? `, ${bb200Peak.weeksAtOne}w at #1` : ''} → set as miss`, color: 'var(--amber)' }
  } else if (bbStatus === 'miss') {
    statusMsg = { text: 'Not found on Hot 100 or Billboard 200 — set as miss or enter manually', color: 'var(--text-dim)' }
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <Field label="Artist"><Input value={f.artist} onChange={v => set('artist', v)} /></Field>
        <Field label="Year"><Input value={f.year} onChange={v => set('year', v)} type="number" /></Field>
      </div>
      {statusMsg && (
        <p style={{ fontSize: '11px', marginBottom: '0.5rem', color: statusMsg.color }}>
          {statusMsg.text}
        </p>
      )}
      <Field label="Verdict">
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['hit', 'miss'].map(v => (
            <button key={v} type="button" onClick={() => {
              set('verdict', v)
              if (v === 'miss') set('peakPosition', '0')
            }} style={{
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

function WhoSampledFields({ f, set, setGenre }) {
  const wsQuery = [f.sourceSong, f.sourceArtist].filter(Boolean).join(' ')
  const wsUrl = wsQuery
    ? `https://www.whosampled.com/search/?q=${encodeURIComponent(wsQuery)}`
    : 'https://www.whosampled.com'

  const sectionHead = (label) => (
    <p style={{
      fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em',
      color: 'var(--text-dim)', textTransform: 'uppercase',
      marginBottom: '0.6rem',
    }}>{label}</p>
  )

  const divider = (label) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      margin: '1rem 0',
    }}>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      <span style={{ fontSize: '11px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  )

  return (
    <>
      {/* ── A: The song players hear ── */}
      <div style={{ padding: '1rem', background: '#0d0d0d', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '0.75rem' }}>
        {sectionHead('A — The newer song (players hear this)')}
        <SongSearch
          placeholder="Search iTunes for the newer song…"
          onSelect={song => {
            if (song.previewUrl) set('audioUrl', song.previewUrl)
            if (song.title)      set('sourceSong', song.title)
            if (song.artist)     set('sourceArtist', song.artist)
            if (song.year)       set('sourceYear', String(song.year))
            if (song.genre)      setGenre(song.genre)
            if (song.artworkUrl) set('sourceArtworkUrl', song.artworkUrl)
            if (song.trackViewUrl) set('sourceItunesUrl', song.trackViewUrl)
          }}
        />
        <Field label="Audio URL">
          <Input value={f.audioUrl} onChange={v => set('audioUrl', v)} placeholder="https://audio-ssl.itunes.apple.com/..." />
        </Field>
        <Field label="iTunes link">
          <Input value={f.sourceItunesUrl} onChange={v => set('sourceItunesUrl', v)} placeholder="https://music.apple.com/..." />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '0.75rem' }}>
          <Field label="Song title"><Input value={f.sourceSong} onChange={v => set('sourceSong', v)} placeholder="e.g. Stronger" /></Field>
          <Field label="Artist"><Input value={f.sourceArtist} onChange={v => set('sourceArtist', v)} placeholder="e.g. Kanye West" /></Field>
          <Field label="Year"><Input value={f.sourceYear} onChange={v => set('sourceYear', v)} type="number" placeholder="2007" /></Field>
        </div>
      </div>

      {divider('↓ sampled ↓')}

      {/* ── B: The original sampled track ── */}
      <div style={{ padding: '1rem', background: '#0d0d0d', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '0.75rem' }}>
        {sectionHead('B — The original sampled track (correct answer)')}
        <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <a
            href={wsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block', fontSize: '12px', color: 'var(--amber)',
              padding: '4px 10px', border: '1px solid var(--amber)',
              borderRadius: '999px', textDecoration: 'none',
            }}
          >
            Look up on WhoSampled →
          </a>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            Fill section A first, then click
          </span>
        </div>
        <SongSearch
          placeholder="Search iTunes for the original sample…"
          onSelect={song => {
            if (song.title)      set('answer', song.title)
            if (song.artist)     set('correctArtist', song.artist)
            if (song.year)       set('sampleYear', String(song.year))
            if (song.previewUrl) set('sampleAudioUrl', song.previewUrl)
            if (song.artworkUrl) set('sampleArtworkUrl', song.artworkUrl)
            if (song.trackViewUrl) set('correctItunesUrl', song.trackViewUrl)
          }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Field label="Song title (= the answer)"><Input value={f.answer} onChange={v => set('answer', v)} placeholder="e.g. Harder, Better, Faster, Stronger" /></Field>
          <Field label="Artist"><Input value={f.correctArtist} onChange={v => set('correctArtist', v)} placeholder="e.g. Daft Punk" /></Field>
          <Field label="Year"><Input value={f.sampleYear} onChange={v => set('sampleYear', v)} type="number" placeholder="2001" /></Field>
        </div>
        <Field label="Sample audio URL">
          <Input value={f.sampleAudioUrl} onChange={v => set('sampleAudioUrl', v)} placeholder="https://audio-ssl.itunes.apple.com/…" />
        </Field>
        <Field label="iTunes link">
          <Input value={f.correctItunesUrl} onChange={v => set('correctItunesUrl', v)} placeholder="https://music.apple.com/..." />
        </Field>
      </div>

      {divider('3 wrong answer choices')}

      {/* ── C: Decoy options ── */}
      <div style={{ padding: '1rem', background: '#0d0d0d', borderRadius: '8px', border: '1px solid var(--border)' }}>
        {sectionHead('C — Decoy options (plausible songs from same era)')}
        {[
          { n: 2, title: 'opt2Title', artist: 'opt2Artist', audio: 'opt2AudioUrl', artwork: 'opt2ArtworkUrl', itunes: 'opt2ItunesUrl' },
          { n: 3, title: 'opt3Title', artist: 'opt3Artist', audio: 'opt3AudioUrl', artwork: 'opt3ArtworkUrl', itunes: 'opt3ItunesUrl' },
          { n: 4, title: 'opt4Title', artist: 'opt4Artist', audio: 'opt4AudioUrl', artwork: 'opt4ArtworkUrl', itunes: 'opt4ItunesUrl' },
        ].map(opt => (
          <div key={opt.n} style={{ marginBottom: opt.n < 4 ? '1rem' : 0 }}>
            <SongSearch
              placeholder={`Search iTunes for wrong option ${opt.n}...`}
              onSelect={song => {
                set(opt.title, song.title || '')
                set(opt.artist, song.artist || '')
                if (song.previewUrl) set(opt.audio, song.previewUrl)
                if (song.artworkUrl) set(opt.artwork, song.artworkUrl)
                if (song.trackViewUrl) set(opt.itunes, song.trackViewUrl)
              }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <Input value={f[opt.title]} onChange={v => set(opt.title, v)} placeholder={`Wrong option ${opt.n} - title`} />
              <Input value={f[opt.artist]} onChange={v => set(opt.artist, v)} placeholder="Artist" />
            </div>
            <Field label={`Wrong option ${opt.n} sample audio URL`}>
              <Input value={f[opt.audio]} onChange={v => set(opt.audio, v)} placeholder="https://audio-ssl.itunes.apple.com/..." />
            </Field>
            <Field label={`Wrong option ${opt.n} iTunes link`}>
              <Input value={f[opt.itunes]} onChange={v => set(opt.itunes, v)} placeholder="https://music.apple.com/..." />
            </Field>
          </div>
        ))}
      </div>
    </>
  )
}

function yearToDecade(year) {
  const y = parseInt(year, 10)
  if (!y || y < 1960) return null
  if (y < 1970) return '60s'
  if (y < 1980) return '70s'
  if (y < 1990) return '80s'
  if (y < 2000) return '90s'
  if (y < 2010) return '00s'
  if (y < 2020) return '10s'
  return '20s'
}

function EraFields({ f, set }) {
  function handleYear(v) {
    set('year', v)
    const decade = yearToDecade(v)
    if (decade) set('answer', decade)
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <Field label="Song title"><Input value={f.songTitle} onChange={v => set('songTitle', v)} /></Field>
        <Field label="Artist"><Input value={f.artist} onChange={v => set('artist', v)} /></Field>
        <Field label="Year">
          <Input value={f.year} onChange={handleYear} type="number" />
        </Field>
      </div>
      <Field label="Correct decade — auto-set from year, or click to override">
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {DECADES.map(d => (
            <button key={d} type="button" onClick={() => set('answer', d)} style={{
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

function MBSearch({ label, onPick }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const debounce = useRef(null)
  const wrap = useRef(null)

  useEffect(() => {
    function close(e) { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounce.current)
    if (val.trim().length < 3) { setResults([]); setOpen(false); return }
    debounce.current = setTimeout(async () => {
      setSearching(true)
      try {
        const hits = await searchRecordings(val)
        setResults(hits)
        setOpen(hits.length > 0)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
  }

  function pick(r) {
    onPick(r)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={wrap} style={{ position: 'relative', marginBottom: '0.5rem' }}>
      <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>{label}</p>
      <div style={{ position: 'relative' }}>
        <input
          value={query}
          onChange={handleChange}
          placeholder="Search MusicBrainz for release year…"
          style={{ ...inputStyle, paddingRight: searching ? '32px' : undefined }}
        />
        {searching && (
          <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-dim)' }}>…</span>
        )}
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#111', border: '1px solid var(--border)',
          borderRadius: '8px', overflow: 'hidden', zIndex: 50,
        }}>
          {results.map((r) => (
            <button
              key={r.mbid}
              type="button"
              onClick={() => pick(r)}
              style={{
                width: '100%', textAlign: 'left', padding: '9px 12px',
                background: 'transparent', border: 'none',
                borderBottom: '1px solid var(--border)', cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{r.title}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>{r.artist}{r.year ? ` · ${r.year}` : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function FlipFields({ f, set }) {
  return (
    <>
      <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '1rem' }}>
        Search iTunes for the cover version — fills title, artist, year, and audio automatically.
      </p>

      {/* The cover song */}
      <div style={{ padding: '1rem', background: '#0d0d0d', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '0.75rem' }}>
        <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
          Cover song
        </p>
        <SongSearch
          placeholder="Search iTunes for the cover…"
          onSelect={song => {
            if (song.title)      set('coverSongTitle', song.title)
            if (song.artist)     set('coverSongArtist', song.artist)
            if (song.year)       set('coverSongYear', String(song.year))
            if (song.previewUrl) set('audioUrl', song.previewUrl)
          }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Field label="Title"><Input value={f.coverSongTitle} onChange={v => set('coverSongTitle', v)} placeholder="Song title" /></Field>
          <Field label="Artist"><Input value={f.coverSongArtist} onChange={v => set('coverSongArtist', v)} placeholder="Artist" /></Field>
          <Field label="Year"><Input value={f.coverSongYear} onChange={v => set('coverSongYear', v)} placeholder="Year" type="number" /></Field>
        </div>
      </div>

      {/* Is it a cover? */}
      <div style={{ padding: '0.75rem 1rem', background: '#0d0d0d', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '0.75rem' }}>
        <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>Is this song a cover?</p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['cover', 'original'].map(v => (
            <button key={v} type="button" onClick={() => set('isCover', v)} style={{
              flex: 1, padding: '7px', borderRadius: '6px', border: '1px solid',
              borderColor: f.isCover === v ? 'var(--amber)' : 'var(--border)',
              background: f.isCover === v ? 'var(--amber-glow)' : 'transparent',
              color: f.isCover === v ? 'var(--amber)' : 'var(--text-muted)',
              fontSize: '13px', cursor: 'pointer', textTransform: 'capitalize',
            }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Original song — only if cover */}
      {f.isCover === 'cover' && (
        <div style={{ padding: '1rem', background: '#0d0d0d', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            Original song
          </p>
          <SongSearch
            placeholder="Search iTunes for the original…"
            onSelect={song => {
              if (song.title)      set('originalTitle', song.title)
              if (song.artist)     set('originalArtist', song.artist)
              if (song.year)       set('originalYear', String(song.year))
              if (song.previewUrl) set('originalAudio', song.previewUrl)
            }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Field label="Title"><Input value={f.originalTitle} onChange={v => set('originalTitle', v)} placeholder="Original title" /></Field>
            <Field label="Artist"><Input value={f.originalArtist} onChange={v => set('originalArtist', v)} placeholder="Original artist" /></Field>
            <Field label="Year"><Input value={f.originalYear} onChange={v => set('originalYear', v)} placeholder="Year" type="number" /></Field>
          </div>
          <Field label="Original audio URL (optional)">
            <Input value={f.originalAudio} onChange={v => set('originalAudio', v)} placeholder="https://audio-ssl.itunes.apple.com/… (optional)" />
          </Field>
        </div>
      )}
    </>
  )
}

// ─── iTunes song search ──────────────────────────────────────────────────────
function SongSearch({ onSelect, placeholder = 'Search for a song...' }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const debounce = useRef(null)
  const wrap = useRef(null)

  useEffect(() => {
    function close(e) { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounce.current)
    if (val.trim().length < 2) { setResults([]); setOpen(false); return }
    debounce.current = setTimeout(async () => {
      const hits = await searchSongs(val)
      setResults(hits)
      setOpen(hits.length > 0)
    }, 280)
  }

  function pick(song) {
    onSelect(song)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={wrap} style={{ position: 'relative', marginBottom: '1.25rem' }}>
      <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
        Search iTunes — fills in audio URL, title, artist & year automatically
      </p>
      <input
        value={query}
        onChange={handleChange}
        placeholder={placeholder}
        style={{ ...inputStyle, background: '#0a0a0a', border: '1px solid var(--amber)' }}
      />
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#111', border: '1px solid var(--border)',
          borderRadius: '8px', overflow: 'hidden', zIndex: 50,
        }}>
          {results.map(song => (
            <button
              key={song.id}
              type="button"
              onClick={() => pick(song)}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 12px',
                background: 'transparent', border: 'none',
                borderBottom: '1px solid var(--border)', cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                {song.title}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                {song.artist}
                {song.year ? ` · ${song.year}` : ''}
                {song.previewUrl ? '' : ' · no preview'}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
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
  const [editingId, setEditingId] = useState(null)
  const [gamePuzzles, setGamePuzzles] = useState([])

  const today = todayEST()
  const startDate = addDays(today, weekOffset * 14)
  const dates = dateRange(startDate, 14)
  const endDate = dates[dates.length - 1]

  const isAdmin = !loading && !!user && !!adminEmail && user.email === adminEmail

  const fetchSchedule = useCallback(async () => {
    if (!isAdmin) return
    const { data } = await supabase
      .from('puzzles')
      .select('id, game_slug, scheduled_date, answer, genre, audio_url, metadata')
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date')
    setPuzzles(data || [])
  }, [isAdmin, startDate, endDate])

  useEffect(() => { fetchSchedule() }, [fetchSchedule])

  useEffect(() => {
    if (!showForm || !isAdmin) return
    supabase
      .from('puzzles')
      .select('id, answer, metadata')
      .eq('game_slug', form.game)
      .then(({ data }) => setGamePuzzles(data || []))
  }, [form.game, showForm, isAdmin])

  if (loading) return null
  if (!isAdmin) return <Navigate to="/" replace />

  // Build a lookup: "date|game_slug" → puzzle row
  const scheduled = {}
  puzzles.forEach(p => { scheduled[`${p.scheduled_date}|${p.game_slug}`] = p })

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function openForm(date, gameSlug) {
    setEditingId(null)
    setForm({ ...BLANK, date, game: gameSlug })
    setShowForm(true)
    setTimeout(() => document.getElementById('admin-form')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  function openEdit(puzzle) {
    setEditingId(puzzle.id)
    setForm(parseRow(puzzle))
    setShowForm(true)
    setTimeout(() => document.getElementById('admin-form')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  async function handleDelete(id) {
    setDeletingId(id)
    await supabase.from('puzzles').delete().eq('id', id)
    await fetchSchedule()
    setDeletingId(null)
  }

  function songKeyFromRow(gameSlug, answer, metadata) {
    switch (gameSlug) {
      case 'era':          return (metadata?.title      || '').toLowerCase().trim()
      case 'cover-or-not': return (metadata?.song_title || '').toLowerCase().trim()
      default:             return (answer               || '').toLowerCase().trim()
    }
  }

  function songKeyFromForm(f) {
    switch (f.game) {
      case 'era':          return f.songTitle.toLowerCase().trim()
      case 'cover-or-not': return f.coverSongTitle.toLowerCase().trim()
      default:             return f.answer.toLowerCase().trim()
    }
  }

  function validateForm(f) {
    const err = []
    if (!f.date)  err.push('Date')
    if (!f.genre) err.push('Genre')
    switch (f.game) {
      case 'one-bar':
        if (!f.audioUrl) err.push('Audio URL')
        if (!f.answer)   err.push('Song title')
        if (!f.artist)   err.push('Artist')
        if (!f.year)     err.push('Year')
        break
      case 'hit-or-miss':
        if (!f.audioUrl)                          err.push('Audio URL')
        if (!f.answer)                            err.push('Song title')
        if (!f.artist)                            err.push('Artist')
        if (!f.year)                              err.push('Year')
        if (f.verdict === 'hit' && !f.peakPosition) err.push('Peak position')
        break
      case 'sampled':
        if (!f.audioUrl)     err.push('Audio URL')
        if (!f.answer)       err.push('Sample song title')
        if (!f.correctArtist) err.push('Correct sample artist')
        if (!f.sampleYear)   err.push('Sample year')
        if (!f.sourceSong)   err.push('Source song')
        if (!f.sourceArtist) err.push('Source artist')
        if (!f.sourceYear)   err.push('Source year')
        if (!f.opt2Title || !f.opt2Artist) err.push('Option 2')
        if (!f.opt3Title || !f.opt3Artist) err.push('Option 3')
        if (!f.opt4Title || !f.opt4Artist) err.push('Option 4')
        if (!f.opt2AudioUrl) err.push('Option 2 sample audio URL')
        if (!f.opt3AudioUrl) err.push('Option 3 sample audio URL')
        if (!f.opt4AudioUrl) err.push('Option 4 sample audio URL')
        if (!f.opt2ItunesUrl) err.push('Option 2 iTunes link')
        if (!f.opt3ItunesUrl) err.push('Option 3 iTunes link')
        if (!f.opt4ItunesUrl) err.push('Option 4 iTunes link')
        break
      case 'era':
        if (!f.audioUrl)  err.push('Audio URL')
        if (!f.answer)    err.push('Decade')
        if (!f.songTitle) err.push('Song title')
        if (!f.artist)    err.push('Artist')
        if (!f.year)      err.push('Year')
        break
      case 'cover-or-not':
        if (!f.audioUrl)        err.push('Audio URL')
        if (!f.coverSongTitle)  err.push('Song title')
        if (!f.coverSongArtist) err.push('Song artist')
        if (f.isCover === 'cover' && !f.originalTitle)  err.push('Original title')
        if (f.isCover === 'cover' && !f.originalArtist) err.push('Original artist')
        break
    }
    return err
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const missing = validateForm(form)
    if (missing.length) { setError(`Missing: ${missing.join(', ')}`); return }
    setSaving(true)
    const row = buildRow(form)

    // Guard against duplicates on insert
    if (!editingId) {
      const { data: existing } = await supabase
        .from('puzzles')
        .select('id')
        .eq('game_slug', form.game)
        .eq('scheduled_date', form.date)
        .limit(1)
      if (existing?.length > 0) {
        setSaving(false)
        setError(`A ${form.game} puzzle already exists for ${form.date}. Use the ✎ button to edit it instead.`)
        return
      }
    }

    const { error: err } = editingId
      ? await supabase.from('puzzles').update(row).eq('id', editingId)
      : await supabase.from('puzzles').insert(row)
    setSaving(false)
    if (err) { setError(err.message); return }
    await fetchSchedule()
    setForm(BLANK)
    setShowForm(false)
    setEditingId(null)
  }

  return (
    <div className="page-shell-admin">
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
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60px' }} title={existing.answer}>
                            {existing.answer}
                          </span>
                          <button
                            onClick={() => openEdit(existing)}
                            style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontSize: '11px', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                            title="Edit"
                          >✎</button>
                          <button
                            onClick={() => handleDelete(existing.id)}
                            disabled={deletingId === existing.id}
                            style={{ color: 'var(--text-dim)', fontSize: '11px', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
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
            <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
              {editingId ? 'Edit puzzle' : 'Add puzzle'}
            </p>
            <button onClick={() => { setShowForm(false); setEditingId(null) }} style={{ color: 'var(--text-dim)', fontSize: '18px', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* iTunes search — hidden for sampled and cover-or-not (they have their own search) */}
            {form.game !== 'sampled' && form.game !== 'cover-or-not' && (
              <SongSearch onSelect={song => {
                setForm(f => ({
                  ...f,
                  audioUrl:  song.previewUrl || f.audioUrl,
                  genre:     song.genre || f.genre,
                  answer:    song.title,
                  artist:    song.artist,
                  year:      song.year ? String(song.year) : f.year,
                  songTitle: song.title,
                  vAAudio:   song.previewUrl || f.vAAudio,
                }))
              }} />
            )}

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
            {(() => {
              const slotKey = `${form.date}|${form.game}`
              const conflict = scheduled[slotKey]
              if (!conflict || conflict.id === editingId) return null
              return (
                <p style={{ fontSize: '12px', color: '#ef4444', marginBottom: '0.75rem' }}>
                  A {GAMES.find(g => g.slug === form.game)?.short} puzzle already exists for this date ({conflict.answer || 'no answer set'}).
                  Use the ✎ button in the grid to edit it instead.
                </p>
              )
            })()}

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

            {/* Audio URL + Answer — common to most games; sampled handles these internally */}
            {form.game !== 'sampled' && form.game !== 'cover-or-not' && (
              <Field label="Audio URL">
                <Input value={form.audioUrl} onChange={v => set('audioUrl', v)} placeholder="https://audio-ssl.itunes.apple.com/..." />
              </Field>
            )}

            {form.game !== 'cover-or-not' && form.game !== 'era' && form.game !== 'sampled' && (
              <Field label="Answer (song title)">
                <Input value={form.answer} onChange={v => set('answer', v)} placeholder="Exact song title" />
              </Field>
            )}

            {/* Game-specific fields */}
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              {form.game === 'one-bar'        && <OneBarFields    f={form} set={set} />}
              {form.game === 'hit-or-miss'     && <HitOrMissFields f={form} set={set} />}
              {form.game === 'sampled'         && <WhoSampledFields f={form} set={set} setGenre={v => set('genre', v)} />}
              {form.game === 'era'            && <EraFields        f={form} set={set} />}
              {form.game === 'cover-or-not'    && <FlipFields       f={form} set={set} />}
            </div>

            {(() => {
              const key = songKeyFromForm(form)
              if (!key) return null
              const dupe = gamePuzzles.find(p =>
                p.id !== editingId && songKeyFromRow(form.game, p.answer, p.metadata) === key
              )
              if (!dupe) return null
              return (
                <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '0.75rem' }}>
                  This song has already been used as a {GAMES.find(g => g.slug === form.game)?.short} puzzle (scheduled {dupe.scheduled_date}). Pick a different song.
                </p>
              )
            })()}

            {error && (
              <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '0.75rem' }}>{error}</p>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              {(() => {
                const dateConflict = !editingId && !!scheduled[`${form.date}|${form.game}`]
                const songKey = songKeyFromForm(form)
                const songConflict = !!songKey && gamePuzzles.some(p =>
                  p.id !== editingId && songKeyFromRow(form.game, p.answer, p.metadata) === songKey
                )
                const blocked = saving || dateConflict || songConflict
                return (
                  <button type="submit" disabled={blocked} className="btn-press" style={{
                    padding: '9px 20px', background: 'var(--amber)', border: 'none',
                    borderRadius: '999px', color: '#0f0f0f', fontSize: '13px',
                    fontWeight: 500, cursor: blocked ? 'not-allowed' : 'pointer', opacity: blocked ? 0.4 : 1,
                  }}>
                    {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add puzzle'}
                  </button>
                )
              })()}
              <button type="button" onClick={() => { setForm(BLANK); setShowForm(false); setEditingId(null) }} style={{
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
