import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Link } from "@tanstack/react-router";
import { Fragment, useRef, useState } from "react";
import { TrashIcon } from "../../../components/ui/icons";
import { dayParts } from "../../../domain/plan";
import { type PackSize, packsFor, packsLabel, packsRepeatNeed, type ShoppingItem, type ShoppingMeal, shoppingItemLabel } from "../../../domain/shopping";

/** How far a row slides left to show Delete behind it. */
export const DELETE_WIDTH = 88;

/** A touch has to travel this far before it is a drag at all, and then it is the row's only if it went more across than down. */
const DRAG_SLOP = 8;

/** Where a row sits while it is dragged: from where it started, never right of closed nor left of open. Pure. */
export function swipeOffset(start: number, dx: number): number {
  return Math.min(0, Math.max(-DELETE_WIDTH, start + dx));
}

/** Where a released row rests: open once dragged more than half way, closed otherwise. Pure. */
export function swipeSettle(offset: number): number {
  return offset < -DELETE_WIDTH / 2 ? -DELETE_WIDTH : 0;
}

/** "Lemon tart · Mon", "Lemon tart 200 g": the dish, its weekday, and its share of a shared line. */
function mealText(meal: ShoppingMeal): string {
  return [meal.name, meal.date === null ? "" : dayParts(meal.date).weekday, meal.amount].filter((part) => part !== "").join(" ");
}

/**
 * One line (decisions.md row 187): the tick box, the amount and food (or the
 * text) — tapping it ticks too — and under it the dishes it is for, each a
 * link to its recipe. Removing it is a trash icon that shows on hover with a
 * mouse, and on a touch screen a swipe left that slides the row off a red
 * Delete. Only one of the two is ever displayed, so only one is in the
 * accessibility tree.
 */
export function ShoppingRow({
  item,
  label = shoppingItemLabel(item),
  meals = [],
  sizes,
  onTick,
  onRemove,
  busy,
}: {
  item: ShoppingItem;
  /** What the row reads: the line, or in the meal view one dish's share of it. */
  label?: string;
  /** The dishes the line is for, linked under it in the aisle view. Empty says nothing. */
  meals?: readonly ShoppingMeal[];
  /**
   * The sizes the line's food is sold in, in the aisle view only: the line is
   * rounded up to whole packs ("→ 2 × 250 g"). Undefined (the meal view,
   * whose rows are shares) rounds nothing.
   */
  sizes?: readonly PackSize[];
  onTick: (id: string, ticked: boolean) => void;
  onRemove: (id: string) => void;
  busy: boolean;
}) {
  const food = item.food;
  // On hand is ticked and not bought, so there is nothing to round.
  const packs = sizes === undefined || food?.skipShopping ? null : packsFor(item, sizes);
  // Packs that only say the line again ("1 can → 1 can") are left off.
  const plan = packs !== null && packsRepeatNeed(packs, item) ? null : packs;

  // The swipe: a touch drag across the row slides it; a drag down is the page's scroll (touch-action: pan-y).
  const [offset, setOffset] = useState(0);
  const drag = useRef<{ x: number; y: number; start: number; across: boolean | null } | null>(null);
  // A drag that ended over the line's text must not also tick it.
  const dragged = useRef(false);

  const release = () => {
    if (drag.current?.across) setOffset(swipeSettle(offset));
    drag.current = null;
  };

  return (
    <li className="group relative overflow-hidden" data-testid="shopping-row" data-ticked={item.ticked ? "true" : "false"}>
      {/* Transparent while the row is closed, so its edges never show past the sliding row; a screen reader still reaches it. */}
      <div
        className={
          offset === 0
            ? "absolute inset-y-0 right-0 flex opacity-0 [@media(hover:hover)]:hidden"
            : "absolute inset-y-0 right-0 flex [@media(hover:hover)]:hidden"
        }
        style={{ width: DELETE_WIDTH }}
      >
        <Button
          type="button"
          variant="solid"
          intent="danger"
          className="h-full w-full rounded-none"
          disabled={busy}
          aria-label={`Remove ${label}`}
          tabIndex={offset === 0 ? -1 : 0}
          onClick={() => onRemove(item.id)}
        >
          Delete
        </Button>
      </div>
      <div
        className="relative flex touch-pan-y items-start gap-3 bg-bg-subtle transition-transform duration-150"
        style={{ transform: `translateX(${offset}px)` }}
        data-testid="shopping-row-body"
        onPointerDown={(event) => {
          if (event.pointerType === "mouse") return;
          drag.current = { x: event.clientX, y: event.clientY, start: offset, across: null };
          dragged.current = false;
        }}
        onPointerMove={(event) => {
          const at = drag.current;
          if (at === null) return;
          const dx = event.clientX - at.x;
          const dy = event.clientY - at.y;
          if (at.across === null && Math.hypot(dx, dy) > DRAG_SLOP) at.across = Math.abs(dx) > Math.abs(dy);
          if (at.across) {
            dragged.current = true;
            setOffset(swipeOffset(at.start, dx));
          }
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onClickCapture={(event) => {
          if (!dragged.current) return;
          dragged.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <Checkbox checked={item.ticked} disabled={busy} className="mt-3.5" aria-label={label} onCheckedChange={(next) => onTick(item.id, next)} />
        <div className="flex min-h-11 min-w-0 flex-1 flex-col justify-center py-2">
          {/* The text is the tick's bigger target; the checkbox carries the name, so this button stays out of the tab order. */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className={item.ticked ? "text-left text-fg-subtle line-through" : "text-left"}
            disabled={busy}
            onClick={() => (offset === 0 ? onTick(item.id, !item.ticked) : setOffset(0))}
          >
            {label}
            {plan !== null && <span className="text-fg-subtle" data-testid="shopping-packs">{` → ${packsLabel(plan)}`}</span>}
          </button>
          {meals.length > 0 && (
            <span className="text-sm text-fg-subtle" data-testid="shopping-meals">
              {meals.map((meal, index) => (
                <Fragment key={`${meal.name}@${meal.date ?? ""}`}>
                  {index > 0 && " · "}
                  {meal.slug === null ? (
                    mealText(meal)
                  ) : (
                    <Link to="/recipes/$slug" params={{ slug: meal.slug }} className="underline-offset-2 hover:text-fg-normal hover:underline">
                      {mealText(meal)}
                    </Link>
                  )}
                </Fragment>
              ))}
            </span>
          )}
        </div>
        {/* With a mouse: a bin that shows on the hovered or focused row. Neutral, as row removal is (design-language rule 5). */}
        <button
          type="button"
          aria-label={`Remove ${label}`}
          data-testid="shopping-remove"
          disabled={busy}
          className="mt-2.5 hidden size-8 shrink-0 items-center justify-center rounded-full text-fg-subtle opacity-0 transition-opacity hover:bg-bg-normal-hovered hover:text-fg-normal focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:flex"
          onClick={() => onRemove(item.id)}
        >
          <TrashIcon />
        </button>
      </div>
    </li>
  );
}
