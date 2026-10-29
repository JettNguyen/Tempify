// The beat between tapping an answer and seeing whether it was right: long
// enough to see your pick light up, short enough that it never reads as
// waiting. The clock stops at the tap, not after the beat, so times stay
// comparable with every one set before.
export const LOCK_IN_MS = 250

/** The beat, or none for someone who asked for less motion. */
export function lockInDelay() {
  const reduced = typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return reduced ? 0 : LOCK_IN_MS
}
