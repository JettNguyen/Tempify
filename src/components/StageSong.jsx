import TrackArtwork from './TrackArtwork'
import './StageSong.css'

/** The song on a stage, for the games where knowing it is part of the puzzle. */
export default function StageSong({ title, artist, meta, src }) {
  return (
    <div className="stage-song">
      <TrackArtwork title={title} artist={artist} src={src} size="small" />
      <div className="stage-song__text">
        {title && <p className="stage-song__title">{title}</p>}
        {artist && (
          <p className="stage-song__artist">
            {artist}{meta ? ` · ${meta}` : ''}
          </p>
        )}
      </div>
    </div>
  )
}
