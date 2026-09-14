// Reading a pointer gesture as a swipe: the thresholds and the verdict.

/** Pixels a pointer must travel vertically before a drag counts as a swipe rather than a scroll. */
export const SWIPE_MIN_PX = 56;

/** How much longer the vertical travel must be than the horizontal for the gesture to be vertical at all. */
export const SWIPE_RATIO = 1.4;

/** A gesture slower than this is a scroll or a rest, not a flick. */
export const SWIPE_MAX_MS = 800;

/** One finished pointer gesture: total travel and how long it took. */
export type Swipe = { dx: number; dy: number; ms: number };

/**
 * Which way a finished gesture moves the deck: swiping up brings the next card
 * on, swiping down the previous one, as a page of cards would. Null for
 * anything that reads as a scroll, a tap, or a sideways drag — the thresholds
 * above are the scroll-versus-swipe line. Pure, so the route only wires
 * pointers to it.
 */
export function swipeIntent({ dx, dy, ms }: Swipe): "next" | "prev" | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(ms)) return null;
  if (ms > SWIPE_MAX_MS || ms < 0) return null;
  if (Math.abs(dy) < SWIPE_MIN_PX) return null;
  if (Math.abs(dy) < Math.abs(dx) * SWIPE_RATIO) return null;
  return dy < 0 ? "next" : "prev";
}
