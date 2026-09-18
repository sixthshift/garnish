import { Button } from "@sixthshift/design-system/button";
import { cn } from "@sixthshift/design-system/utils";
import { type ReactNode, useId, useRef } from "react";
import { moveItem } from "../../lib/lists";
import { Chevron, Cross, Grip } from "./icons";
import { useReorderDrag } from "./useReorderDrag";

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
  const { draggingKey, onHandleDown, onHandleMove, onHandleUp, stop } = useReorderDrag({ items, keyOf, onReorder, group, self, listRef, onMoveOut });
  const last = items.length - 1;

  return (
    <ol ref={listRef} className={cn("flex flex-col gap-2", className)} data-reorder-group={group}>
      {items.map((item, index) => {
        const name = `${itemName} ${index + 1}`;
        const dragging = draggingKey !== null && draggingKey === keyOf(item);
        return (
          <li
            key={keyOf(item)}
            className={cn("flex items-center gap-2 rounded-md", dragging && "opacity-60 ring-1 ring-current/20")}
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
              onPointerCancel={stop}
              onLostPointerCapture={stop}
              onClick={(event) => event.preventDefault()}
            >
              <Grip />
            </button>
            <div className="min-w-0 flex-1">{renderItem(item, index)}</div>
            <fieldset className="flex shrink-0 items-center gap-1" aria-label={`Reorder ${name}`}>
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
              {/* Neutral, not danger: colour is for state, and a red glyph on
                  every row of an eight-row list made delete the loudest thing
                  in the editor. The consequence is carried by the confirm step,
                  where danger intent belongs. */}
              {onRemove !== undefined && (
                <Button type="button" variant="ghost" intent="neutral" size="sm" iconOnly aria-label={`Remove ${name}`} onClick={() => onRemove(item, index)}>
                  <Cross />
                </Button>
              )}
            </fieldset>
          </li>
        );
      })}
    </ol>
  );
}
