/**
 * The logic behind `SwipeRow` (src/components/ui/SwipeRow.tsx): a row a
 * finger drags sideways to do one thing to the right and another to the left
 * (decisions.md row 208). Pure, so the component only wires pointers to it.
 */

/** Travel before a drag counts as sideways at all, rather than a tap or the start of a scroll. */
export const SWIPE_ROW_START_PX = 8;

/** Travel past which letting go does the row's action; under it the row springs back. */
export const SWIPE_ROW_COMMIT_PX = 90;

export type SwipeSide = "right" | "left";

/**
 * Whether a drag that has moved `dx`, `dy` from where it began is the row's
 * own (sideways), the page's (a scroll), or not yet either. Decided once, as
 * soon as either axis passes the start distance, and kept for the rest of the
 * drag by the caller.
 */
export function swipeAxis(dx: number, dy: number): "row" | "page" | null {
  const x = Math.abs(dx);
  const y = Math.abs(dy);
  if (x <= SWIPE_ROW_START_PX && y <= SWIPE_ROW_START_PX) return null;
  return x > y ? "row" : "page";
}

/**
 * How far the row follows the finger: all the way towards a side that has an
 * action, not at all towards one that has none.
 */
export function swipeOffset(dx: number, sides: { right: boolean; left: boolean }): number {
  if (dx > 0) return sides.right ? dx : 0;
  if (dx < 0) return sides.left ? dx : 0;
  return 0;
}

/** Which action letting go at `offset` does, or null to spring back. */
export function swipeOutcome(offset: number): SwipeSide | null {
  if (offset >= SWIPE_ROW_COMMIT_PX) return "right";
  if (offset <= -SWIPE_ROW_COMMIT_PX) return "left";
  return null;
}
