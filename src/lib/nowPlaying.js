import { GAME_BY_SLUG } from './games'

// What the iPhone's lock screen and Control Center player say about the app.
// Left to itself iOS names the page the sound came from, and in the app that
// page lives at capacitor://localhost. It shows the game and never the song,
// since a lock screen naming the song would give One Bar's answer away.

const ARTWORK = [{ src: `${import.meta.env.BASE_URL}icon-512.png`, sizes: '512x512', type: 'image/png' }]

export function labelNowPlaying(pathname) {
  const session = typeof navigator !== 'undefined' ? navigator.mediaSession : null
  if (!session || typeof MediaMetadata === 'undefined') return
  const slug = pathname.match(/\/game\/([^/]+)/)?.[1]
  try {
    session.metadata = new MediaMetadata({
      title: GAME_BY_SLUG[slug]?.name ?? 'Tempify',
      artist: 'Tempify',
      artwork: ARTWORK,
    })
  } catch {
    // Refused or unsupported: the sound still plays.
  }
}
