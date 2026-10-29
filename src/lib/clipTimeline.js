// The player's timeline, as numbers. Kept out of the component so the mapping
// between seconds, the bar, and the pixels under a finger can be tested alone.

// Segments are laid out on a stylised scale, not in real seconds. In seconds the
// first two guesses each buy the same half-second, so they render as twin blocks,
// and every concave rescaling of the real timings makes the second segment
// *smaller* than the first, which reads worse still. Giving each stage a fixed
// step more room than the one before is the only arrangement that rises the
// whole way, and it has a second benefit: a half-second clip sweeps a visible
// segment instead of nudging the playhead two percent of the bar.
export const SEGMENT_GROWTH = 1.45

/**
 * Cuts `total` seconds at each of `stops` (cumulative seconds), returning the
 * segments with their place on the bar: `offset` and `width` are fractions of
 * the bar with the gaps left out. Null when there is nothing to cut.
 */
export function buildSegments(stops, total) {
  if (!stops?.length || !(total > 0) || !isFinite(total)) return null
  const cuts = []
  let prev = 0
  for (const stop of stops) {
    const end = Math.min(stop, total)
    if (end > prev) cuts.push({ start: prev, end })
    prev = end
    if (prev >= total) break
  }
  if (!cuts.length) return null

  const weights = cuts.map((_, i) => SEGMENT_GROWTH ** i)
  const sum = weights.reduce((a, b) => a + b, 0)
  let offset = 0
  return cuts.map((cut, i) => {
    const width = weights[i] / sum
    const seg = { ...cut, width, offset }
    offset += width
    return seg
  })
}

/** Where a moment in the audio sits on the bar, 0-1. The bar is piecewise
 *  linear: even pace inside a segment, changing pace at each guess boundary. */
export function timeToBar(segments, t) {
  const last = segments[segments.length - 1]
  for (const seg of segments) {
    if (t < seg.end || seg === last) {
      const within = (t - seg.start) / (seg.end - seg.start)
      return seg.offset + seg.width * Math.min(Math.max(within, 0), 1)
    }
  }
  return 1
}

/** The inverse, for turning a touch on the bar back into a time. */
export function barToTime(segments, x) {
  const last = segments[segments.length - 1]
  for (const seg of segments) {
    if (x < seg.offset + seg.width || seg === last) {
      const within = (x - seg.offset) / seg.width
      return seg.start + (seg.end - seg.start) * Math.min(Math.max(within, 0), 1)
    }
  }
  return last.end
}

/**
 * The pixel a bar position lands on, for a track `width` wide with `gap` pixels
 * between segments. Without segments the bar is the track.
 */
export function barToPixel(segments, x, width, gap) {
  if (!segments) return x * width
  const room = Math.max(0, width - gap * (segments.length - 1))
  const last = segments.length - 1
  for (let i = 0; i <= last; i++) {
    const seg = segments[i]
    if (x <= seg.offset + seg.width || i === last) {
      const within = Math.min(Math.max((x - seg.offset) / seg.width, 0), 1)
      return (seg.offset + seg.width * within) * room + i * gap
    }
  }
  return width
}

/**
 * The bar position under a pixel. A pixel in a gap belongs to the end of the
 * segment before it, which is where the finger meant: the gap is the boundary.
 */
export function pixelToBar(segments, px, width, gap) {
  if (!(width > 0)) return 0
  if (!segments) return Math.min(Math.max(px / width, 0), 1)
  const room = Math.max(1, width - gap * (segments.length - 1))
  let edge = 0
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const span = seg.width * room
    if (px < edge + span || i === segments.length - 1) {
      const within = Math.min(Math.max((px - edge) / span, 0), 1)
      return seg.offset + seg.width * within
    }
    edge += span
    if (px < edge + gap) return seg.offset + seg.width
    edge += gap
  }
  return 1
}
