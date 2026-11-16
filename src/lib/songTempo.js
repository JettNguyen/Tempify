import { loadClip } from './audioEngine.js'
import { onsets, HOP } from './beatGrid.js'
import { clipTempo, SURE_ENOUGH } from './clipTempo.js'
import { findTrackBpm } from './deezer.js'

// A song's tempo for a Tap the Tempo game a player makes, found two ways: read
// from its clip (lib/clipTempo), and the store's listed tempo (Deezer). The
// clip read works for every song with a clip; the listing is missing for about
// half of all Hot 100 hits (48 of 90 in an 11/15/2026 sample) and now and then
// wrong (Love Story (Taylor's Version) listed at 111, the record runs at 119).
// Where both exist they agreed on 35 of 41.

// Tempos a person can tap. The database holds a made game to the same range.
const RANGE = [40, 240]
const inRange = (bpm) => Number.isFinite(bpm) && bpm >= RANGE[0] && bpm <= RANGE[1]

/** The same beat within 3%, counting half and double speed, as the game's scoring does. */
export function sameBeat(a, b) {
  return [b, b / 2, b * 2].some(t => Math.abs(a - t) / t <= 0.03)
}

/**
 * The tempo to fill in, from the listed tempo (a number or null) and the clip
 * read ({ bpm, sure } or null), as { bpm, check }. `check` asks the maker to
 * tap along: the two disagree, or the clip was a close call with nothing to
 * back it up.
 */
export function settleTempo(listed, read) {
  const hasListed = inRange(listed)
  const hasRead = Boolean(read) && inRange(read.bpm)
  const sure = hasRead && read.sure >= SURE_ENOUGH
  // Agreeing, the listing's number: the one a player would look up, at the
  // speed it's usually counted.
  if (hasListed && hasRead && sameBeat(read.bpm, listed)) return { bpm: Math.round(listed), check: false }
  if (hasListed && hasRead) return { bpm: sure ? read.bpm : Math.round(listed), check: true }
  if (hasRead) return { bpm: read.bpm, check: !sure }
  if (hasListed) return { bpm: Math.round(listed), check: false }
  return { bpm: null, check: true }
}

/** The tempo the clip itself keeps, or null when it can't be read. */
export async function readClipTempo(audioUrl) {
  const buffer = await loadClip(audioUrl)
  const channels = Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, c) => buffer.getChannelData(c))
  return clipTempo(onsets(channels, buffer.sampleRate), HOP / buffer.sampleRate)
}

/** A song's tempo for a made game, as settleTempo gives it. Never throws. */
export async function findSongTempo(title, artist, audioUrl) {
  const [listed, read] = await Promise.all([
    findTrackBpm(title, artist).catch(() => null),
    audioUrl ? readClipTempo(audioUrl).catch(() => null) : null,
  ])
  return settleTempo(listed, read)
}
