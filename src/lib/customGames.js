import { supabase } from './supabase.js'
import { GAME_BY_SLUG } from './games.js'
import { siteUrl, challengeValue } from './challenge.js'

// Games a Tempify+ player makes for friends (migration 019). One plays at
// /game/<slug>?c=<code>, on the same page as the daily game, so its link
// preview and challenge links (vs=, by=) work the way a daily game's do.
// The maker's name rides along as m=, only for the link preview: the game
// itself reads it from the database.
//
//   /game/era?c=3f9a01b2ce&m=dana
//   /game/era?c=3f9a01b2ce&m=dana&vs=1000.500.0.1000&by=sam

/** The games that can be made, in the order the builder offers them. */
export const CUSTOM_SLUGS = ['era', 'hit-or-miss', 'one-bar']

/** How many songs each one takes. The database holds the same limits. */
export const SONG_LIMITS = {
  era: { min: 3, max: 5 },
  'hit-or-miss': { min: 3, max: 5 },
  'one-bar': { min: 1, max: 1 },
}

const CODE = /^[a-f0-9]{10}$/

export function isCustomCode(code) {
  return CODE.test(code || '')
}

// As short as a username is allowed to get long, so a doctored m= can't
// fill a preview.
const MAX_NAME = 24

/** Stands in for a day wherever a game keeps its progress on this device. */
export const customKey = (code) => `c-${code}`

function gameName(slug) {
  return GAME_BY_SLUG[slug]?.name || 'Tempify'
}

/** "dana's Era", or "Your Era" to the person who made it. */
export function customTitle({ maker, mine = false, slug }) {
  if (mine) return `Your ${gameName(slug)}`
  return maker ? `${maker}'s ${gameName(slug)}` : `A friend's ${gameName(slug)}`
}

/** Who made it, the way the top of the game screen says it. */
export function makerTag({ maker, mine }) {
  if (mine) return 'your game'
  return maker ? `by ${maker}` : 'by a friend'
}

/** The query string for a made game's link. A score makes it a challenge. */
export function customQuery({ code, maker, points, guesses, name }) {
  const params = new URLSearchParams({ c: code })
  if (maker) params.set('m', maker.slice(0, MAX_NAME))
  const vs = challengeValue({ points, guesses })
  if (vs != null) {
    params.set('vs', vs)
    if (name) params.set('by', name)
  }
  return params.toString()
}

/** A made game's link on the public site, carrying `score` when given. */
export function customUrl(game, score, { name, ...where } = {}) {
  const path = GAME_BY_SLUG[game.slug]?.path || '/'
  return siteUrl(`${path}?${customQuery({ code: game.code, maker: game.maker, ...(score || {}), name })}`, where)
}

/** What the maker sends with the link. */
export function inviteText(game) {
  const n = game.rounds?.length || 0
  if (game.slug === 'one-bar') return 'I picked a song for you on Tempify. Can you name it from half a second?'
  if (game.slug === 'hit-or-miss') return `I picked ${n} songs for you on Tempify. Can you guess how high each one got on the Hot 100?`
  return `I picked ${n} songs for you on Tempify. Can you put them in order by year?`
}

/** Where the button under a finished game goes. */
export function customNext(custom) {
  return custom.mine ? { path: '/make', label: 'Your games' } : { path: '/make', label: 'Make your own' }
}

/** The puzzle a game screen expects, made from a game's songs. */
export function customPuzzle(game) {
  if (game.slug === 'one-bar') {
    const [song = {}] = game.rounds
    return {
      id: game.code,
      game_slug: 'one-bar',
      answer: song.title,
      audio_url: song.audio_url,
      metadata: { artist: song.artist, artwork_url: song.artwork_url },
    }
  }
  return { id: game.code, game_slug: game.slug, metadata: { rounds: game.rounds } }
}

function toGame(row) {
  return {
    code: row.code,
    slug: row.game_slug,
    rounds: Array.isArray(row.rounds) ? row.rounds : [],
    maker: row.maker || null,
    makerId: row.maker_id || null,
    createdAt: row.created_at,
    scores: row.scores ?? null,
  }
}

// ─── The database ────────────────────────────────────────────────────────────

/** One game by its code, or null when there's no such game. */
export async function getCustomGame(code) {
  const { data, error } = await supabase.rpc('get_custom_game', { p_code: code })
  if (error) throw error
  return data ? toGame(data) : null
}

/** The games the signed-in player made, newest first. */
export async function listMyCustomGames() {
  const { data, error } = await supabase.rpc('my_custom_games')
  if (error) throw error
  return (data || []).map(toGame)
}

/** What to tell the maker when a save is turned down. */
export function saveErrorText(error) {
  const message = error?.message || ''
  if (message.includes('premium only')) {
    return 'Saving a game takes Tempify+. If you already have it, open the Tempify+ page and tap Refresh status, then try again.'
  }
  if (message.includes('too many today')) return "You've made 25 games today. You can make more tomorrow."
  return "Couldn't save the game. Check your connection and try again."
}

/** Saves a game and returns its code. Throws an Error that says what to do. */
export async function createCustomGame(slug, rounds) {
  const { data, error } = await supabase.rpc('create_custom_game', { p_game_slug: slug, p_rounds: rounds })
  if (error || !data) throw new Error(saveErrorText(error))
  return data
}

export async function deleteCustomGame(code) {
  const { data, error } = await supabase.rpc('delete_custom_game', { p_code: code })
  if (error) throw error
  return Boolean(data)
}

/** Puts a signed-in player's first finish on the game's board. */
export async function saveCustomScore(code, { points, guesses }) {
  const { data, error } = await supabase.rpc('save_custom_score', {
    p_code: code,
    p_points: points ?? null,
    p_guesses: guesses ?? null,
  })
  if (error) throw error
  return Boolean(data)
}

/** The game's scoreboard, best first: [{ username, points, guesses, me, place }]. */
export async function getCustomScores(code) {
  const { data, error } = await supabase.rpc('get_custom_scores', { p_code: code })
  if (error) throw error
  return Array.isArray(data) ? data : []
}

// ─── This device ─────────────────────────────────────────────────────────────

// A finished game, kept per player the way daily completions are, so a
// second account on the same phone gets its own go.
const resultKey = (userId, code) => `tempify_custom_${userId || 'guest'}_${code}`

export function readCustomResult(userId, code) {
  try {
    return JSON.parse(localStorage.getItem(resultKey(userId, code)) || 'null')
  } catch {
    return null
  }
}

export function writeCustomResult(userId, code, result) {
  try {
    localStorage.setItem(resultKey(userId, code), JSON.stringify(result))
  } catch {
    // Storage full or blocked: the game still plays, it just won't remember.
  }
}
