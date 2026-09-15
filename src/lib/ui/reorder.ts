// The geometry behind ReorderList: moving an item, and where a drop lands.

/** The vertical span of one row, in client coordinates. */
export type Span = { top: number; bottom: number };

/** A client rectangle, as `getBoundingClientRect` returns it. */
export type Box = { left: number; right: number; top: number; bottom: number };

/** Whether the point sits inside the box, edges included. Pure. */
export function rectContains(box: Box, x: number, y: number): boolean {
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}

/**
 * Where a dragged row belongs, given the rows' current spans and the pointer's
 * y. Pure.
 *
 * With `from` — a drag inside its own list, where `spans` still includes the
 * dragged row — the answer is an index to move that row to: it slides past a
 * neighbour only once the pointer has crossed that neighbour's midpoint, so a
 * row never swaps twice for one crossing. With `from` null — a drag arriving
 * from another list — the answer is an insertion point, from 0 to `length`.
 */
export function dropIndex(spans: readonly Span[], y: number, from: number | null = null): number {
  const middle = (span: Span) => (span.top + span.bottom) / 2;
  if (from === null) {
    let at = 0;
    while (at < spans.length && middle(spans[at] as Span) < y) at += 1;
    return at;
  }
  if (spans.length === 0) return 0;
  if (from < 0 || from >= spans.length) return from < 0 ? 0 : spans.length - 1;
  let to = from;
  for (let i = 0; i < from; i += 1) {
    if (y < middle(spans[i] as Span)) {
      to = i;
      break;
    }
  }
  for (let i = from + 1; i < spans.length; i += 1) {
    if (y > middle(spans[i] as Span)) to = i;
  }
  return to;
}
