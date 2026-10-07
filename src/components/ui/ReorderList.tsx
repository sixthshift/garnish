import { Button } from "@sixthshift/design-system/button";
import { cn } from "@sixthshift/design-system/utils";
import { type ReactNode, useId, useRef } from "react";
import { moveItem } from "../../lib/lists";
import { Chevron, Cross, Grip } from "./icons";
import { useReorderDrag } from "./useReorderDrag";

/**
 * What a row placing its own controls (`narrow="row"`) is handed: the drag
 * handle, and the moves for its menu, each absent at its end of the list.
 */
export type ReorderRow = {
  handle: ReactNode;
  moveUp?: () => void;
  moveDown?: () => void;
};

/**
 * Where a row's controls go while the list is narrower than 42rem (`@2xl`, the
 * list's own width, so a list nested in another one decides for itself). From
 * there up they sit beside the content whatever this says.
 *
 * - "beside": beside the content, as on a wide list.
 * - "above": on a line of their own over the content, after the row's name,
 *   so a tall row (a part, a note) gives its content the full width.
 * - "row": none of them; `renderItem` gets a `ReorderRow` and places the
 *   handle and the moves itself, for a row with a menu of its own (a step,
 *   an ingredient).
 *   The row's narrow classes must use the same `@2xl` container.
 */
export type ReorderNarrow = "beside" | "above" | "row";

export type ReorderListProps<T> = {
  items: readonly T[];
  keyOf: (item: T) => string;
  onReorder: (items: T[]) => void;
  /** The third argument is only for `narrow="row"`, where the row places the handle and the moves itself. */
  renderItem: (item: T, index: number, row: ReorderRow) => ReactNode;
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
  /** Where the controls go while the list is narrow. Default "beside". */
  narrow?: ReorderNarrow;
  /**
   * A row of column labels over the rows, hidden from assistive technology
   * (each field names itself). It is laid out like a row — room for the
   * handle (unless `narrow="row"`, where the header places its own) and for
   * the up, down and remove buttons wherever a row shows them — so a header
   * whose columns match the row's lines up with them. "beside" and "row" only.
   * Its line takes back the list's gap, so a header whose content hides at
   * some width leaves no space there; content that shows sets its own space
   * below it (`mb-2`).
   */
  header?: ReactNode;
  /** Classes for the header's line, e.g. a breakpoint that hides it. */
  headerClassName?: string;
  /**
   * How the up, down and remove buttons sit against a row taller than they
   * are: "center" (default), or "start", level with a row's first line, for
   * a one-line row that sometimes grows a quiet line under it (an ingredient).
   */
  align?: "center" | "start";
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
  narrow = "beside",
  header,
  headerClassName,
  align = "center",
  className,
}: ReorderListProps<T>) {
  const generatedKey = useId();
  const self = listKey ?? generatedKey;
  const listRef = useRef<HTMLOListElement | null>(null);
  const { draggingKey, onHandleDown, onHandleMove, onHandleUp, stop } = useReorderDrag({ items, keyOf, onReorder, group, self, listRef, onMoveOut });
  const last = items.length - 1;

  // The list measures itself only when its narrow layout differs, so a
  // "beside" list sized by its content is never made a container.
  const contained = narrow !== "beside";
  // Where a row shows its up, down and remove buttons; the header keeps room for them there.
  const controlsClass = cn("flex shrink-0 items-center gap-1", narrow === "above" && "@max-2xl:ml-auto", narrow === "row" && "@max-2xl:hidden");
  // Their width: each a small icon-only Button (w-8, 2rem), 0.25rem apart.
  const controlCount = onRemove === undefined ? 2 : 3;
  const controlsWidth = `${controlCount * 2 + (controlCount - 1) * 0.25}rem`;

  return (
    <ol
      ref={listRef}
      className={cn("flex flex-col gap-2", contained && "@container", className)}
      data-reorder-group={group}
      data-narrow={contained ? narrow : undefined}
    >
      {header !== undefined && (
        <li className={cn("-mb-2 flex items-end gap-2", headerClassName)} aria-hidden="true" data-reorder-header="">
          {narrow !== "row" && <span className="w-6 shrink-0" />}
          <div className="min-w-0 flex-1">{header}</div>
          <span className={controlsClass} style={{ width: controlsWidth }} />
        </li>
      )}
      {items.map((item, index) => {
        const name = `${itemName} ${index + 1}`;
        const dragging = draggingKey !== null && draggingKey === keyOf(item);
        const moveUp = index === 0 ? undefined : () => onReorder(moveItem(items, index, index - 1));
        const moveDown = index === last ? undefined : () => onReorder(moveItem(items, index, index + 1));
        const handle = (
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Drag ${name}`}
            title={`Drag to reorder ${name}`}
            className="mt-1 shrink-0 cursor-grab touch-none select-none rounded p-1 text-current/50 hover:text-current focus-visible:outline-none active:cursor-grabbing @max-2xl:mt-0"
            onPointerDown={(event) => onHandleDown(event, index)}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={stop}
            onLostPointerCapture={stop}
            onClick={(event) => event.preventDefault()}
          >
            <Grip />
          </button>
        );
        return (
          <li
            key={keyOf(item)}
            className={cn(
              "flex gap-2 rounded-md",
              align === "start" ? "items-start" : "items-center",
              narrow === "above" && "@max-2xl:flex-wrap",
              dragging && "opacity-60 ring-1 ring-current/20"
            )}
            data-index={index}
            data-dragging={dragging ? "" : undefined}
          >
            {narrow !== "row" && handle}
            {narrow === "above" && (
              <span className="text-sm font-medium text-fg-subtle capitalize @2xl:hidden" aria-hidden="true">
                {name}
              </span>
            )}
            <div className={cn("min-w-0 flex-1", narrow === "above" && "@max-2xl:order-last @max-2xl:basis-full")}>
              {renderItem(item, index, { handle, ...(moveUp && { moveUp }), ...(moveDown && { moveDown }) })}
            </div>
            <fieldset className={controlsClass} aria-label={`Reorder ${name}`}>
              <Button type="button" variant="ghost" intent="neutral" size="sm" iconOnly aria-label={`Move ${name} up`} disabled={!moveUp} onClick={moveUp}>
                <Chevron direction="up" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                intent="neutral"
                size="sm"
                iconOnly
                aria-label={`Move ${name} down`}
                disabled={!moveDown}
                onClick={moveDown}
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
