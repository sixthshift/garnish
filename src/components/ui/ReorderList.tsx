// Ordered list whose rows move with up/down buttons, a "move to" the parent
// supplies, or by dragging a handle. The parent owns the array: every move
// calls `onReorder` with a new array and this component renders whatever comes
// back. Rows keep their React key across moves, so a focused button stays
// focused on the row it moved and a captured pointer stays attached to the
// handle it grabbed.
//
// Drag is pointer events by hand, no dependency. A handle starts it; a mouse
// or pen starts immediately, a touch waits 250 ms so a flick that begins on the
// handle is still a scroll, and any movement past a few pixels inside that
// window cancels the drag rather than starting one. Once live the handle
// captures the pointer, so the drag survives the row being re-rendered
// somewhere else in the list.
//
// Within a list the reorder is live: each move past a neighbour's midpoint
// calls `onReorder`, so what you see under the finger is the real order.
// Between lists it is not: lists sharing a `group` register their element in a
// module-level map, the pointer is hit-tested against them, and the drop is
// reported once on release through `onMoveOut` — the parent decides what
// moving a row between two lists means.
//
// All the arithmetic lives in `dropIndex` and `rectContains`, which are pure
// and exported, because the drag itself needs a real pointer and these do not.
import { Button } from "@sixthshift/design-system/button";
import { cn } from "@sixthshift/design-system/utils";
import { type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { type Span, rectContains, dropIndex } from "../../lib/ui/reorder";
import { moveItem } from "../../lib/lists";

/** Milliseconds a touch must rest on the handle before the drag starts. */
export const TOUCH_DELAY_MS = 250;

/** Pixels a pointer may drift inside the touch delay before the drag is abandoned as a scroll. */
export const DRAG_TOLERANCE_PX = 8;

export type ReorderListProps<T> = {
  items: readonly T[];
  keyOf: (item: T) => string;
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
  /** When given, each row grows a remove button. */
  onRemove?: (item: T, index: number) => void;
  /** Names the list and each row's buttons ("Move ingredient 2 up"). Default "item". */
  itemName?: string;
  /**
   * Lists sharing a group id accept each other's rows. Dropping a row on
   * another list in the group calls this list's `onMoveOut`; nothing moves
   * without it.
   */
  group?: string;
  /** This list's identity inside the group, handed back to `onMoveOut`. Defaults to a generated id. */
  listKey?: string;
  /** A row of this list was dropped on the list named `toList`, at `toIndex`. */
  onMoveOut?: (item: T, from: number, toList: string, toIndex: number) => void;
  className?: string;
};

// --- Cross-list registry ----------------------------------------------------

const groups = new Map<string, Map<string, HTMLElement>>();

function registerList(group: string, key: string, element: HTMLElement): () => void {
  let members = groups.get(group);
  if (!members) {
    members = new Map();
    groups.set(group, members);
  }
  members.set(key, element);
  return () => {
    members.delete(key);
    if (members.size === 0) groups.delete(group);
  };
}

/** The other list in `group` under the pointer, if any. */
function listAtPoint(group: string, self: string, x: number, y: number): { key: string; element: HTMLElement } | null {
  const members = groups.get(group);
  if (!members) return null;
  for (const [key, element] of members) {
    if (key === self) continue;
    if (rectContains(element.getBoundingClientRect(), x, y)) return { key, element };
  }
  return null;
}

/** The vertical spans of a list's own rows, skipping any nested list's. */
function rowSpans(list: HTMLElement): Span[] {
  return Array.from(list.querySelectorAll<HTMLElement>(":scope > li[data-index]")).map((row) => {
    const box = row.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom };
  });
}

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

// --- Component --------------------------------------------------------------

export function ReorderList<T>({
  items,
  keyOf,
  onReorder,
  renderItem,
  onRemove,
  itemName = "item",
  group,
  listKey,
  onMoveOut,
  className,
}: ReorderListProps<T>) {
  const generatedKey = useId();
  const self = listKey ?? generatedKey;
  const listRef = useRef<HTMLOListElement | null>(null);
  const drag = useRef<Drag | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const last = items.length - 1;

  useEffect(() => {
    const list = listRef.current;
    if (group === undefined || list === null) return;
    return registerList(group, self, list);
  }, [group, self]);

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

  return (
    <ol ref={listRef} className={cn("flex flex-col gap-2", className)} data-reorder-group={group}>
      {items.map((item, index) => {
        const name = `${itemName} ${index + 1}`;
        const dragging = draggingKey !== null && draggingKey === keyOf(item);
        return (
          <li
            key={keyOf(item)}
            className={cn("flex items-start gap-2 rounded-md", dragging && "opacity-60 ring-1 ring-current/20")}
            data-index={index}
            data-dragging={dragging ? "" : undefined}
          >
            <button
              type="button"
              tabIndex={-1}
              aria-label={`Drag ${name}`}
              title={`Drag to reorder ${name}`}
              className="mt-1 shrink-0 cursor-grab touch-none select-none rounded p-1 text-current/50 hover:text-current focus-visible:outline-none active:cursor-grabbing"
              onPointerDown={(event) => onHandleDown(event, index)}
              onPointerMove={onHandleMove}
              onPointerUp={onHandleUp}
              onPointerCancel={() => stop()}
              onLostPointerCapture={() => stop()}
              onClick={(event) => event.preventDefault()}
            >
              <Grip />
            </button>
            <div className="min-w-0 flex-1">{renderItem(item, index)}</div>
            <div className="flex shrink-0 items-center gap-1" role="group" aria-label={`Reorder ${name}`}>
              <Button
                type="button"
                variant="ghost"
                intent="neutral"
                size="sm"
                iconOnly
                aria-label={`Move ${name} up`}
                disabled={index === 0}
                onClick={() => onReorder(moveItem(items, index, index - 1))}
              >
                <Chevron direction="up" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                intent="neutral"
                size="sm"
                iconOnly
                aria-label={`Move ${name} down`}
                disabled={index === last}
                onClick={() => onReorder(moveItem(items, index, index + 1))}
              >
                <Chevron direction="down" />
              </Button>
              {onRemove !== undefined && (
                <Button type="button" variant="ghost" intent="danger" size="sm" iconOnly aria-label={`Remove ${name}`} onClick={() => onRemove(item, index)}>
                  <Cross />
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Grip() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  );
}

function Chevron({ direction }: { direction: "up" | "down" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === "up" ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
    </svg>
  );
}

function Cross() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
