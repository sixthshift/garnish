// Ordered list whose rows move with up/down buttons. Drag comes later; buttons
// first because they work on a phone, with a keyboard, and under a screen
// reader with nothing extra. The parent owns the array: every move calls
// `onReorder` with a new array and this component renders whatever comes back.
// Rows keep their React key across moves, so a focused button stays focused
// on the row it moved.
import { Button } from "@sixthshift/design-system/button";
import { cn } from "@sixthshift/design-system/utils";
import type { ReactNode } from "react";

export type ReorderListProps<T> = {
  items: readonly T[];
  keyOf: (item: T) => string;
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
  /** When given, each row grows a remove button. */
  onRemove?: (item: T, index: number) => void;
  /** Names the list and each row's buttons ("Move ingredient 2 up"). Default "item". */
  itemName?: string;
  className?: string;
};

/**
 * A new array with the item at `from` moved to `to`. Out-of-range indices, or
 * `from === to`, return a copy in the original order. Pure.
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = items.slice();
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return next;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as T);
  return next;
}

export function ReorderList<T>({ items, keyOf, onReorder, renderItem, onRemove, itemName = "item", className }: ReorderListProps<T>) {
  const last = items.length - 1;
  return (
    <ol className={cn("flex flex-col gap-2", className)}>
      {items.map((item, index) => {
        const name = `${itemName} ${index + 1}`;
        return (
          <li key={keyOf(item)} className="flex items-start gap-2" data-index={index}>
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
