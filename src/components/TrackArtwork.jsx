import { useEffect, useState } from 'react'
import { findArtwork } from '../lib/itunes'
import { optimizeArtworkUrl } from '../lib/artwork'
import './TrackArtwork.css'

export default function TrackArtwork({ title, artist, src, label, size = 'medium' }) {
  const [artwork, setArtwork] = useState(optimizeArtworkUrl(src, size) || null)

  useEffect(() => {
    let cancelled = false
    setArtwork(optimizeArtworkUrl(src, size) || null)

    if (src || !title) return

    findArtwork({ title, artist })
      .then((url) => {
        if (!cancelled && url) setArtwork(optimizeArtworkUrl(url, size))
      })
      .catch(() => {
        // Keep fallback UI if lookup fails.
      })

    return () => { cancelled = true }
  }, [title, artist, src, size])

  return (
    <div className={`track-artwork track-artwork--${size}`}>
      {artwork ? (
        <img
          src={artwork}
          alt=""
          className="track-artwork__img"
          loading={size === 'medium' ? 'eager' : 'lazy'}
          fetchPriority={size === 'medium' ? 'high' : 'auto'}
          decoding="async"
        />
      ) : (
        <div className="track-artwork__fallback" aria-hidden="true">
          <span />
        </div>
      )}
      {label && <p className="track-artwork__label">{label}</p>}
    </div>
  )
}
