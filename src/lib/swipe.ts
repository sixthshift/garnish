/** Pixels a pointer must travel sideways before a flick counts as a swipe rather than a tap. */
export const SWIPE_MIN_PX = 56;

/** How much longer the sideways travel must be than the vertical for the gesture to be sideways at all. */
export const SWIPE_RATIO = 1.4;

/** A gesture slower than this is a drag or a rest, not a flick. */
export const SWIPE_MAX_MS = 800;

/** The share of the card's width a slow drag must cover to move the deck, as a page turned by hand. */
export const SWIPE_DRAG_SHARE = 0.35;

/** One finished pointer gesture: total travel, how long it took and, when known, the width of what was dragged. */
export type Swipe = { dx: number; dy: number; ms: number; width?: number };

/**
 * Which way a finished gesture moves the deck: swiping left brings the next
 * card on, swiping right the previous one, as a book's pages turn (decisions.md
 * row 208: a phone's cook cards go sideways). A quick flick past
 * `SWIPE_MIN_PX` counts; so does a slow drag across `SWIPE_DRAG_SHARE` of
 * `width`. Null for anything that reads as a scroll, a tap or a short nudge,
 * so the card springs back. Pure, so the deck only wires pointers to it.
 */
export function swipeIntent({ dx, dy, ms, width }: Swipe): "next" | "prev" | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(ms) || ms < 0) return null;
  if (Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return null;
  const flick = ms <= SWIPE_MAX_MS && Math.abs(dx) >= SWIPE_MIN_PX;
  const dragged = width !== undefined && width > 0 && Math.abs(dx) >= width * SWIPE_DRAG_SHARE;
  if (!flick && !dragged) return null;
  return dx < 0 ? "next" : "prev";
}
