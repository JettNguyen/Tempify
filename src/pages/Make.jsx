import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Share } from '@capacitor/share'
import { useAuth } from '../hooks/useAuth'
import { GAME_BY_SLUG } from '../lib/games'
import { isNativeApp } from '../lib/oauth'
import { copyText } from '../lib/clipboard'
import { hapticSelection, hapticRejected, hapticImportantTap } from '../lib/haptics'
import { stripVariant } from '../lib/deezer'
import {
  CUSTOM_SLUGS, SONG_LIMITS, createCustomGame, listMyCustomGames, deleteCustomGame,
  customUrl, customTitle, inviteText,
} from '../lib/customGames'
import {
  chartEntry, prepareSong, sameSong, whatsMissing, toRounds, validYear, validPeak, taggedTitle, FIRST_YEAR,
} from '../lib/customSongs'
import AudioPlayer from '../components/AudioPlayer'
import GameGlyph from '../components/GameGlyph'
import GuessInput from '../components/GuessInput'
import TrackArtwork from '../components/TrackArtwork'
import DelayedSpinner from '../components/DelayedSpinner'
import Icon from '../components/Icon'
import './Make.css'

// Making a game for friends, a Tempify+ perk. Pick a game, pick its songs,
// save, send the link. The game plays on the daily game's own screen
// (src/games/CustomGame.jsx); this page only builds them and lists the
// ones made.

const PICK_LINES = {
  era: 'Pick 3 to 5 songs. Friends put them in order by year.',
  'hit-or-miss': 'Pick 3 to 5 songs. Friends guess how high each one charted.',
  'one-bar': 'Pick one song. Friends name it from half a second.',
}

const BUILD_HELP = {
  era: 'The first song starts on the line with its year showing, and friends place the rest. Years are when each song first made the Hot 100.',
  'hit-or-miss': "Peaks come from the Hot 100. A song that isn't on it counts as never charted.",
  'one-bar': 'Friends hear half a second of it, and each wrong guess plays a bit more.',
}

const THIS_YEAR = new Date().getFullYear()

const playPath = (game) => `${GAME_BY_SLUG[game.slug].path}?c=${game.code}`

// ─── The draft ───────────────────────────────────────────────────────────────

// Songs picked but not saved yet stay on this device, so leaving the page
// halfway doesn't lose them.
const DRAFT_KEY = 'tempify_make_draft_v1'

function readDraft(slug) {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
    return draft?.slug === slug && Array.isArray(draft.songs) ? draft.songs : []
  } catch {
    return []
  }
}

function writeDraft(slug, songs) {
  try {
    if (songs.length) localStorage.setItem(DRAFT_KEY, JSON.stringify({ slug, songs }))
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    // Storage blocked: the draft just won't survive leaving the page.
  }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY) } catch { /* nothing to clear */ }
}

// ─── The page ────────────────────────────────────────────────────────────────

export default function Make() {
  const { user, profile, loading } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [made, setMade] = useState(null)
  const picked = searchParams.get('game')
  const slug = CUSTOM_SLUGS.includes(picked) ? picked : null

  if (loading) {
    return <div className="page-shell-narrow"><DelayedSpinner active label="Loading..." /></div>
  }
  if (!user || !profile?.is_subscribed) return <Pitch signedIn={Boolean(user)} />

  if (made) {
    return (
      <Ready
        game={made}
        onAnother={() => { hapticSelection(); setMade(null) }}
      />
    )
  }

  if (slug) {
    return (
      <Builder
        key={slug}
        slug={slug}
        onMade={(game) => {
          setMade({ ...game, maker: profile?.username || null })
          navigate('/make', { replace: true })
        }}
      />
    )
  }

  return <Start maker={profile?.username || null} />
}

// For a player who can't make games yet: what it is, and the way in.
function Pitch({ signedIn }) {
  return (
    <div className="page-shell-narrow make">
      <p className="make-eyebrow">make a game</p>
      <h1 className="make-title">Make a game for friends</h1>
      <p className="make-body">
        Pick the songs and Tempify fills in the answers. Send the link, and friends play it free,
        with or without an account. Everyone signed in goes on that game's scoreboard.
      </p>

      <ul className="make-pitch-list">
        {CUSTOM_SLUGS.map((slug) => (
          <li key={slug} className={`make-pitch-item game-theme--${slug}`}>
            <GameGlyph slug={slug} className="make-pitch-item__glyph" />
            <span>
              <span className="make-pitch-item__name">{GAME_BY_SLUG[slug].name}</span>
              <span className="make-pitch-item__line">{PICK_LINES[slug]}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="make-note">Making games comes with Tempify+. Playing one a friend sends you is free.</p>
      {signedIn ? (
        <Link to="/subscribe" className="make-primary btn-press">See Tempify+ plans</Link>
      ) : (
        <Link to="/login" state={{ from: '/make' }} className="make-primary btn-press">Log in</Link>
      )}
    </div>
  )
}

// Pick a game to make, and the games made so far.
function Start({ maker }) {
  const navigate = useNavigate()
  return (
    <div className="page-shell-narrow make">
      <p className="make-eyebrow">make a game</p>
      <h1 className="make-title">Make a game for friends</h1>
      <p className="make-body">
        Pick a game, then the songs. Tempify fills in the answers, and friends can play without an account.
      </p>

      <div className="make-games">
        {CUSTOM_SLUGS.map((slug, i) => (
          <button
            key={slug}
            type="button"
            className={`make-game card-hover btn-press game-theme--${slug}`}
            style={{ '--i': i }}
            onClick={() => { hapticSelection(); navigate(`/make?game=${slug}`) }}
          >
            <GameGlyph slug={slug} className="make-game__glyph" />
            <span className="make-game__name">{GAME_BY_SLUG[slug].name}</span>
            <span className="make-game__line">{PICK_LINES[slug]}</span>
            <Icon name="chevronRight" size={15} className="make-game__go" />
          </button>
        ))}
      </div>

      <MyGames maker={maker} />
    </div>
  )
}

// ─── Building one ────────────────────────────────────────────────────────────

function Builder({ slug, onMade }) {
  const { max } = SONG_LIMITS[slug]
  const game = GAME_BY_SLUG[slug]
  const [songs, setSongs] = useState(() => readDraft(slug).slice(0, max))
  const [adding, setAdding] = useState(null)
  const [notice, setNotice] = useState(null)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const searchRef = useRef(null)

  useEffect(() => { writeDraft(slug, songs) }, [slug, songs])

  // The Hot 100 list is a big file, so start loading it before the first pick.
  useEffect(() => { if (slug !== 'one-bar') chartEntry('', '').catch(() => {}) }, [slug])

  const missing = whatsMissing(slug, songs)
  const full = songs.length >= max

  async function add(track) {
    searchRef.current?.clear()
    const picked = { title: stripVariant(track.title), artist: track.artist }
    if (songs.some(s => sameSong(s, picked))) {
      hapticRejected()
      setNotice(`"${picked.title}" is already in this game.`)
      return
    }
    setNotice(null)
    setSaveError(null)
    setAdding(picked.title)
    try {
      const song = await prepareSong(slug, track)
      if (!song) {
        hapticRejected()
        setNotice(`Couldn't find a clip of "${picked.title}". Try another version of it, or another song.`)
        return
      }
      setSongs(prev => (prev.length >= max ? prev : [...prev, song]))
    } catch {
      setNotice("Couldn't look that song up. Check your connection and try again.")
    } finally {
      setAdding(null)
    }
  }

  function change(i, fields) {
    setSongs(prev => prev.map((s, j) => (j === i ? { ...s, ...fields, from: 'hand' } : s)))
  }

  function remove(i) {
    hapticSelection()
    setEditing(null)
    setSongs(prev => prev.filter((_, j) => j !== i))
  }

  function moveToStart(i) {
    hapticSelection()
    setEditing(0)
    setSongs(prev => [prev[i], ...prev.filter((_, j) => j !== i)])
  }

  async function save() {
    if (missing || saving) return
    hapticImportantTap()
    setSaving(true)
    setSaveError(null)
    const rounds = toRounds(slug, songs)
    try {
      const code = await createCustomGame(slug, rounds)
      clearDraft()
      onMade({ code, slug, rounds })
    } catch (err) {
      setSaveError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className={`page-shell-narrow make game-theme--${slug}`}>
      <Link to="/make" className="game-back-link tap-target"><Icon name="chevronLeft" size={14} />Back</Link>

      <p className="make-eyebrow make-eyebrow--game">
        <GameGlyph slug={slug} className="make-eyebrow__glyph" />
        {game.name.toLowerCase()}
      </p>
      <div className="make-build-head">
        <h1 className="make-title">{max === 1 ? 'Pick a song' : 'Pick the songs'}</h1>
        {max > 1 && <span className="make-count">{songs.length} of {max}</span>}
      </div>
      <p className="make-body">{BUILD_HELP[slug]}</p>

      {!full && (
        <div className="make-search">
          <GuessInput
            ref={searchRef}
            onGuess={add}
            disabled={Boolean(adding) || saving}
            placeholder="Search for a song to add..."
          />
          {adding && <p className="make-status" role="status">Finding a clip of "{adding}"...</p>}
          {notice && <p className="make-notice" role="status">{notice}</p>}
        </div>
      )}

      {songs.length > 0 && (
        <ol className="make-songs">
          {songs.map((song, i) => (
            <SongRow
              key={`${song.title}|${song.artist}`}
              slug={slug}
              song={song}
              first={i === 0}
              open={editing === i}
              onOpen={() => { hapticSelection(); setEditing(editing === i ? null : i) }}
              onChange={(fields) => change(i, fields)}
              onRemove={() => remove(i)}
              onMoveToStart={() => moveToStart(i)}
            />
          ))}
        </ol>
      )}

      <div className="make-save-wrap">
        <button
          type="button"
          className="make-primary make-save btn-press"
          onClick={save}
          disabled={Boolean(missing) || saving || Boolean(adding)}
        >
          {saving ? 'Saving...' : 'Save and get the link'}
        </button>
        {missing && !saveError && <p className="make-hint">{missing}</p>}
        {saveError && <p className="make-error" role="alert">{saveError}</p>}
      </div>
    </div>
  )
}

/** The answer a song carries, the way the builder says it. `open` is whether its panel is. */
function answerLine(slug, song, open) {
  const add = open ? '' : ' Tap Change to add it.'
  if (slug === 'era') {
    if (!validYear(song.year)) return { text: `Needs a year.${add}`, warn: true }
    if (song.from === 'chart') return { text: `First charted in ${song.year}` }
    if (song.from === 'store') return { text: `${song.year}, from the store. A reissue can show a later year, so check it.`, warn: true }
    return { text: `${song.year}` }
  }
  if (slug === 'hit-or-miss') {
    if (!validPeak(song.peak)) return { text: `Needs a peak.${add}`, warn: true }
    const peak = Number(song.peak)
    if (peak === 0) {
      return song.from === 'hand'
        ? { text: 'Never charted' }
        : { text: "Not on the Hot 100, so it counts as never charted. If it did chart, change it.", warn: true }
    }
    const weeks = peak === 1 && song.from === 'chart' && song.weeks_at_one
      ? ` · ${song.weeks_at_one} week${song.weeks_at_one === 1 ? '' : 's'} at #1`
      : ''
    return { text: `Peaked at #${peak}${weeks}` }
  }
  const plain = taggedTitle(song.title)
  return plain
    ? { text: `Friends have to pick this exact version to get it right. If search has a plain "${plain}", take this out and add that one.`, warn: true }
    : null
}

function SongRow({ slug, song, first, open, onOpen, onChange, onRemove, onMoveToStart }) {
  const answer = answerLine(slug, song, open)
  const never = slug === 'hit-or-miss' && song.peak !== '' && song.peak != null && Number(song.peak) === 0

  return (
    <li className={`make-song${open ? ' make-song--open' : ''}`}>
      <div className="make-song__row">
        <TrackArtwork title={song.title} artist={song.artist} src={song.artwork_url} size="small" />
        <div className="make-song__text">
          <p className="make-song__title">
            {song.title}
            {slug === 'era' && first && <span className="make-song__start">Starts on the line</span>}
          </p>
          <p className="make-song__artist">{song.artist}</p>
          {answer && <p className={`make-song__answer${answer.warn ? ' make-song__answer--warn' : ''}`}>{answer.text}</p>}
        </div>
        <button type="button" className="make-song__change btn-press tap-target" onClick={onOpen}>
          {open ? 'Done' : slug === 'one-bar' ? 'Hear it' : 'Change'}
        </button>
      </div>

      {open && (
        <div className="make-song__panel">
          <AudioPlayer src={song.audio_url} label={`Clip of ${song.title}`} />

          {slug === 'era' && (
            <label className="make-field">
              <span className="make-field__label">Year</span>
              <input
                type="number"
                inputMode="numeric"
                min={FIRST_YEAR}
                max={THIS_YEAR}
                value={song.year ?? ''}
                onChange={(e) => onChange({ year: e.target.value === '' ? '' : Number(e.target.value) })}
                className="make-field__input"
              />
            </label>
          )}

          {slug === 'hit-or-miss' && (
            <div className="make-field">
              <span className="make-field__label">Peak on the Hot 100</span>
              <div className="make-field__row">
                <span className="make-field__hash" aria-hidden="true">#</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  value={never ? '' : song.peak ?? ''}
                  placeholder={never ? 'Never' : ''}
                  disabled={never}
                  aria-label="Peak position, 1 to 100"
                  onChange={(e) => onChange({ peak: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="make-field__input"
                />
                <button
                  type="button"
                  className={`make-toggle btn-press${never ? ' make-toggle--on' : ''}`}
                  aria-pressed={never}
                  onClick={() => { hapticSelection(); onChange({ peak: never ? '' : 0 }) }}
                >
                  Never charted
                </button>
              </div>
            </div>
          )}

          <div className="make-song__tools">
            {slug === 'era' && !first && (
              <button type="button" className="make-text-btn btn-press" onClick={onMoveToStart}>
                Start with this song
              </button>
            )}
            <button type="button" className="make-text-btn make-text-btn--danger btn-press" onClick={onRemove}>
              <Icon name="trash" size={13} />
              Take it out
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

// ─── Saved ───────────────────────────────────────────────────────────────────

function Ready({ game, onAnother }) {
  return (
    <div className={`page-shell-narrow make make-ready game-theme--${game.slug}`}>
      <span className="make-ready__badge">
        <Icon name="check" size={18} strokeWidth={2.5} />
      </span>
      <h1 className="make-title">Your game is ready</h1>
      <p className="make-body">
        Send the link to friends. They can play without an account, and anyone signed in goes on its scoreboard.
      </p>

      <InviteButton game={game} primary />
      <Link to={playPath(game)} className="make-secondary btn-press">Play it yourself</Link>
      <button type="button" className="make-text-btn btn-press" onClick={onAnother}>Make another game</button>
    </div>
  )
}

/** Sends a game's link: the share sheet in the app, the clipboard on the web. */
function InviteButton({ game, primary = false }) {
  const [state, setState] = useState('idle')
  const resetRef = useRef(0)
  const where = { native: isNativeApp(), origin: window.location.origin, base: import.meta.env.BASE_URL || '/' }
  const url = customUrl(game, null, where)

  useEffect(() => () => clearTimeout(resetRef.current), [])

  async function send() {
    hapticSelection()
    const text = inviteText(game)
    if (isNativeApp()) {
      try {
        await Share.share({ title: customTitle({ maker: game.maker, slug: game.slug }), text, url, dialogTitle: 'Send your game' })
        return
      } catch (err) {
        // Closing the sheet rejects too, and that isn't a failure.
        if (/cancel/i.test(err?.message || '')) return
      }
    }
    const ok = await copyText(`${text}\n${url}`)
    setState(ok ? 'copied' : 'failed')
    clearTimeout(resetRef.current)
    // A failed copy stays up with the link to copy by hand.
    if (ok) resetRef.current = setTimeout(() => setState('idle'), 2000)
  }

  const label = state === 'copied' ? 'Link copied' : state === 'failed' ? "Couldn't copy" : 'Send the link'
  const icon = state === 'copied' ? 'check' : state === 'failed' ? 'alert' : 'share'

  return (
    <>
      <button
        type="button"
        onClick={send}
        className={`${primary ? 'make-primary' : 'make-chip'} btn-press${state === 'copied' ? ' make-copied' : ''}`}
      >
        <Icon name={icon} size={14} />
        {label}
      </button>
      {state === 'failed' && (
        <p className="make-hint make-hint--link">
          Copy this link by hand: <span className="make-link">{url}</span>
        </p>
      )}
    </>
  )
}

// ─── Made so far ─────────────────────────────────────────────────────────────

function MyGames({ maker }) {
  const [games, setGames] = useState(null)
  const [failed, setFailed] = useState(false)
  const [confirming, setConfirming] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  useEffect(() => {
    let cancelled = false
    listMyCustomGames()
      .then((found) => { if (!cancelled) setGames(found) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [])

  async function remove(code) {
    hapticImportantTap('tap')
    setDeleteError(null)
    try {
      await deleteCustomGame(code)
      setGames(prev => prev.filter(g => g.code !== code))
      setConfirming(null)
    } catch {
      setDeleteError("Couldn't delete it. Check your connection and try again.")
    }
  }

  if (failed) {
    return (
      <section className="make-mine">
        <p className="make-section-label">your games</p>
        <p className="make-hint">Couldn't load your games. Check your connection, then open this page again.</p>
      </section>
    )
  }
  if (!games) return <DelayedSpinner active inline label="Loading your games..." />
  if (games.length === 0) return null

  return (
    <section className="make-mine">
      <p className="make-section-label">your games</p>
      <ul className="make-mine__list">
        {games.map((g) => {
          const n = g.rounds.length
          const scores = g.scores || 0
          return (
            <li key={g.code} className={`make-mine__item game-theme--${g.slug}`}>
              <div className="make-mine__top">
                <GameGlyph slug={g.slug} className="make-mine__glyph" />
                <div className="make-mine__text">
                  <p className="make-mine__name">
                    {GAME_BY_SLUG[g.slug]?.name}
                    <span className="make-mine__meta"> · {n} song{n === 1 ? '' : 's'}</span>
                  </p>
                  <p className="make-mine__songs">{g.rounds.map(r => r.title).join(', ')}</p>
                </div>
                <span className="make-mine__scores">
                  {scores ? `${scores} score${scores === 1 ? '' : 's'}` : 'No scores yet'}
                </span>
              </div>

              {confirming === g.code ? (
                <div className="make-mine__confirm">
                  <p className="make-hint">Delete this game? Its link stops working, and its scoreboard goes with it.</p>
                  <div className="make-mine__actions">
                    <button type="button" className="make-chip make-chip--danger btn-press" onClick={() => remove(g.code)}>
                      Delete it
                    </button>
                    <button
                      type="button"
                      className="make-chip btn-press"
                      onClick={() => { hapticSelection(); setConfirming(null); setDeleteError(null) }}
                    >
                      Keep it
                    </button>
                  </div>
                  {deleteError && <p className="make-error" role="alert">{deleteError}</p>}
                </div>
              ) : (
                <div className="make-mine__actions">
                  <InviteButton game={{ ...g, maker }} />
                  <Link to={playPath(g)} className="make-chip btn-press">Play</Link>
                  <button
                    type="button"
                    className="make-chip make-chip--quiet btn-press"
                    onClick={() => { hapticSelection(); setConfirming(g.code); setDeleteError(null) }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
