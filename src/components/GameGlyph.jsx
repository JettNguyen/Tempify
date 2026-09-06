// One symbol per game, drawn on a 120x120 grid. These sit behind the tile
// content as a large watermark, so they're built from bold, simple shapes that
// stay readable at low opacity rather than fine detail that turns to mud.
const GLYPHS = {
  // A clip of a waveform — the sliver of audio you get to hear.
  'one-bar': (
    <g>
      {[30, 62, 98, 46, 80, 38, 22].map((h, i) => (
        <rect key={i} x={8 + i * 16} y={60 - h / 2} width="10" height={h} rx="5" fill="currentColor" />
      ))}
    </g>
  ),
  // A chart climbing toward the Hot 100.
  'hit-or-miss': (
    <g>
      {[26, 46, 70, 96].map((h, i) => (
        <rect key={i} x={14 + i * 26} y={108 - h} width="16" height={h} rx="4" fill="currentColor" />
      ))}
    </g>
  ),
  // A record — the decade you're trying to place.
  'era': (
    <g fill="none" stroke="currentColor" strokeWidth="7">
      <circle cx="60" cy="60" r="50" />
      <circle cx="60" cy="60" r="30" />
      <circle cx="60" cy="60" r="9" />
    </g>
  ),
  // Two takes on the same song, overlapping.
  'cover-or-not': (
    <g fill="none" stroke="currentColor" strokeWidth="7">
      <circle cx="44" cy="60" r="34" />
      <circle cx="76" cy="60" r="34" />
    </g>
  ),
  // Retired, but archive days still render it: a slice lifted off a stack.
  'sampled': (
    <g>
      <rect x="14" y="30" width="92" height="16" rx="8" fill="currentColor" />
      <rect x="14" y="54" width="64" height="16" rx="8" fill="currentColor" />
      <rect x="14" y="78" width="80" height="16" rx="8" fill="currentColor" />
    </g>
  ),
}

export default function GameGlyph({ slug, className }) {
  const glyph = GLYPHS[slug]
  if (!glyph) return null

  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      {glyph}
    </svg>
  )
}
