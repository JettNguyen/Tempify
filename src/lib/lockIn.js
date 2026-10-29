// The beat between committing an answer and seeing whether it was right. The
// pick lights up and holds for a moment before the result lands, which is what
// makes the tap feel like a decision rather than a click. The clock stops at the
// tap, not after the beat, so times stay comparable with every one set before.
export const LOCK_IN_MS = 650

/** The beat, or none for someone who asked for less motion. */
export function lockInDelay() {
  const reduced = typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return reduced ? 0 : LOCK_IN_MS
}
