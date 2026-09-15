import { type PointerEvent as ReactPointerEvent, type RefObject, useEffect, useRef, useState } from "react";
import { moveItem } from "../../lib/lists";
import { dropIndex } from "../../lib/ui/reorder";
import { listAtPoint, registerList, rowSpans } from "../../lib/ui/reorderGroups";

/** Milliseconds a touch must rest on the handle before the drag starts. */
export const TOUCH_DELAY_MS = 250;

/** Pixels a pointer may drift inside the touch delay before the drag is abandoned as a scroll. */
export const DRAG_TOLERANCE_PX = 8;

type Drag = {
  pointerId: number;
  handle: HTMLElement;
  /** Where the row sits now; it changes as a same-list drag reorders. */
  index: number;
  startX: number;
  startY: number;
  live: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  /** The other list the pointer is over, and where the row would land in it. */
  over: { list: string; index: number } | null;
};

export type ReorderDragOptions<T> = {
  items: readonly T[];
  keyOf: (item: T) => string;
  onReorder: (items: T[]) => void;
  group: string | undefined;
  /** This list's identity inside the group. */
  self: string;
  listRef: RefObject<HTMLOListElement | null>;
  onMoveOut?: (item: T, from: number, toList: string, toIndex: number) => void;
};

export type ReorderDrag = {
  /** The key of the row being dragged, while one is. */
  draggingKey: string | null;
  onHandleDown: (event: ReactPointerEvent<HTMLElement>, index: number) => void;
  onHandleMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onHandleUp: (event: ReactPointerEvent<HTMLElement>) => void;
  /** Abandon the drag, releasing the pointer. */
  stop: () => void;
};

export function useReorderDrag<T>({ items, keyOf, onReorder, group, self, listRef, onMoveOut }: ReorderDragOptions<T>): ReorderDrag {
  const drag = useRef<Drag | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (group === undefined || list === null) return;
    return registerList(group, self, list);
  }, [group, self, listRef]);

  // A drag left running when the row unmounts would keep its timer alive.
  useEffect(() => {
    return () => {
      const state = drag.current;
      if (state !== null && state.timer !== null) clearTimeout(state.timer);
      drag.current = null;
    };
  }, []);

  const stop = () => {
    const state = drag.current;
    drag.current = null;
    if (state === null) return state;
    if (state.timer !== null) clearTimeout(state.timer);
    if (state.live && state.handle.hasPointerCapture?.(state.pointerId)) state.handle.releasePointerCapture(state.pointerId);
    setDraggingKey(null);
    return state;
  };

  const start = (state: Drag) => {
    state.timer = null;
    state.live = true;
    state.handle.setPointerCapture?.(state.pointerId);
    const item = items[state.index];
    setDraggingKey(item === undefined ? null : keyOf(item));
  };

  const onHandleDown = (event: ReactPointerEvent<HTMLElement>, index: number) => {
    if (event.button !== 0) return;
    stop();
    const state: Drag = {
      pointerId: event.pointerId,
      handle: event.currentTarget,
      index,
      startX: event.clientX,
      startY: event.clientY,
      live: false,
      timer: null,
      over: null,
    };
    drag.current = state;
    if (event.pointerType === "touch") {
      state.timer = setTimeout(() => {
        if (drag.current === state) start(state);
      }, TOUCH_DELAY_MS);
    } else {
      start(state);
    }
  };

  const onHandleMove = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (state === null || state.pointerId !== event.pointerId) return;
    if (!state.live) {
      // Still inside the touch delay: any real movement is a scroll, not a drag.
      if (Math.abs(event.clientX - state.startX) > DRAG_TOLERANCE_PX || Math.abs(event.clientY - state.startY) > DRAG_TOLERANCE_PX) stop();
      return;
    }
    event.preventDefault();
    if (group !== undefined && onMoveOut !== undefined) {
      const target = listAtPoint(group, self, event.clientX, event.clientY);
      if (target !== null) {
        state.over = { list: target.key, index: dropIndex(rowSpans(target.element), event.clientY, null) };
        return;
      }
    }
    state.over = null;
    const list = listRef.current;
    if (list === null) return;
    const to = dropIndex(rowSpans(list), event.clientY, state.index);
    if (to === state.index) return;
    onReorder(moveItem(items, state.index, to));
    state.index = to;
  };

  const onHandleUp = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (state === null || state.pointerId !== event.pointerId) return;
    const ended = stop();
    if (ended === null || !ended.live || ended.over === null) return;
    const item = items[ended.index];
    if (item !== undefined) onMoveOut?.(item, ended.index, ended.over.list, ended.over.index);
  };

  return { draggingKey, onHandleDown, onHandleMove, onHandleUp, stop: () => void stop() };
}
