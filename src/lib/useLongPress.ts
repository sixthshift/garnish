// A long press, for a control that has no room to be visible all the time.
// The recipe page's quick edit (M27.5) uses it: from `md` the pencil appears
// on hover, and below `md` — where there is no hover — holding a finger on the
// row for half a second opens the same sheet.
//
// Same shape as cook mode's swipe (src/domain/cook.ts): the decision is a pure
// function over what the pointer did, and the hook is the thin wrapper that
// arms a timer and cancels it. Touch and pen only — a mouse has the hover
// affordance, and hijacking its press would fight text selection and the row's
// own click.
import { useCallback, useEffect, useRef } from "react";

/** How long a pointer has to stay down before the press counts as long. */
export const LONG_PRESS_MS = 500;

/** How far a pointer may drift and still be a press rather than a scroll. */
export const LONG_PRESS_MOVE_PX = 10;

/** One pointer press, so far: what kind of pointer it is and how far it has drifted. */
export type LongPress = { pointerType: string; dx: number; dy: number; ms: number };

/**
 * Whether a press has become a long press: a touch or pen held past
 * `LONG_PRESS_MS` without drifting more than `LONG_PRESS_MOVE_PX`. A mouse is
 * never a long press, and neither is a drag (that is a scroll) or a tap that
 * lifted early. Pure, so the hook below only wires pointers to it.
 */
export function isLongPress({ pointerType, dx, dy, ms }: LongPress): boolean {
  if (pointerType !== "touch" && pointerType !== "pen") return false;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(ms)) return false;
  if (ms < LONG_PRESS_MS) return false;
  return Math.hypot(dx, dy) <= LONG_PRESS_MOVE_PX;
}

/** The handlers a long-pressable element spreads onto itself. */
export type LongPressHandlers = {
  onPointerDown: (event: { pointerType: string; clientX: number; clientY: number }) => void;
  onPointerMove: (event: { clientX: number; clientY: number }) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
};

/**
 * Call `onLongPress` when a touch or pen is held still on the element for
 * `LONG_PRESS_MS`. The timer is armed on pointer down and cleared by a lift, a
 * cancel, a drift past the threshold, or unmounting, so nothing fires after
 * the element is gone.
 */
export function useLongPress(onLongPress: () => void): LongPressHandlers {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ pointerType: string; x: number; y: number } | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }, []);

  useEffect(() => clear, [clear]);

  return {
    onPointerDown: (event) => {
      clear();
      if (!isLongPress({ pointerType: event.pointerType, dx: 0, dy: 0, ms: LONG_PRESS_MS })) return;
      start.current = { pointerType: event.pointerType, x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        start.current = null;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerMove: (event) => {
      const from = start.current;
      if (from === null) return;
      if (!isLongPress({ pointerType: from.pointerType, dx: event.clientX - from.x, dy: event.clientY - from.y, ms: LONG_PRESS_MS })) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
  };
}
