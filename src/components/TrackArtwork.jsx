import { useEffect, useState } from 'react'
import { findArtwork } from '../lib/itunes'
import './TrackArtwork.css'

export default function TrackArtwork({ title, artist, src, label, size = 'medium' }) {
  const [artwork, setArtwork] = useState(src || null)

  useEffect(() => {
    let cancelled = false
    setArtwork(src || null)

    if (src || !title) return

    findArtwork({ title, artist })
      .then((url) => {
        if (!cancelled && url) setArtwork(url)
      })
      .catch(() => {
        // Keep fallback UI if lookup fails.
      })

    return () => { cancelled = true }
  }, [title, artist, src])

  return (
    <div className={`track-artwork track-artwork--${size}`}>
      {artwork ? (
        <img src={artwork} alt="" className="track-artwork__img" loading="lazy" />
      ) : (
        <div className="track-artwork__fallback" aria-hidden="true">
          <span />
        </div>
      )}
      {label && <p className="track-artwork__label">{label}</p>}
    </div>
  )
}
