import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { cn } from "@sixthshift/design-system/utils";
import { Fragment, useRef, useState } from "react";
import { RecipeLink } from "../../../components/recipe/RecipeLink";
import { TrashIcon } from "../../../components/ui/icons";
import { SwipeRow } from "../../../components/ui/SwipeRow";
import { dayParts } from "../../plan/plan";
import { type PackSize, packsFor, packsLabel, packsRepeatNeed, type ShoppingItem, type ShoppingMeal, shoppingItemLabel } from "../shopping";

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
 *
 * In the shop, on a phone (decisions.md row 208), a row is `big`, and an
 * unticked one also takes a swipe right into the trolley (`SwipeRow`'s right
 * side): the same tick the box and a tap on the line give. The swipe left
 * stays this row's own two-step Delete, so no single gesture removes a line
 * before its button has been seen.
 */
export function ShoppingRow({
  item,
  label = shoppingItemLabel(item),
  meals = [],
  sizes,
  onTick,
  onRemove,
  busy,
  className,
  surface = "bg-bg-subtle",
  big = false,
  trolley = false,
}: {
  item: ShoppingItem;
  /** What the row reads: the line itself, unless the caller says it another way. */
  label?: string;
  /** The dishes the line is for, linked under it. Empty says nothing. */
  meals?: readonly ShoppingMeal[];
  /**
   * The sizes the line's food is sold in: the line is rounded up to whole
   * packs ("→ 2 × 250 g"). Undefined rounds nothing.
   */
  sizes?: readonly PackSize[];
  onTick: (id: string, ticked: boolean) => void;
  onRemove: (id: string) => void;
  busy: boolean;
  /** The row's own classes: the desktop's walk dims a row, or slides it out to the trolley. */
  className?: string;
  /** The row's background, which must match what it sits on so the Delete behind it never shows: the page's, unless it sits on a panel or is lit. */
  surface?: string;
  /** A phone's row in the shop: taller, with a bigger box and larger text, for a thumb on the move. */
  big?: boolean;
  /** A swipe right ticks it into the trolley: a phone's unticked row. The box is still the way in for a keyboard or a screen reader. */
  trolley?: boolean;
}) {
  const food = item.food;
  // On hand is ticked and not bought, so there is nothing to round.
  const packs = sizes === undefined || food?.skipShopping ? null : packsFor(item, sizes);
  // Packs that only say the line again ("1 can → 1 can") are left off.
  const plan = packs !== null && packsRepeatNeed(packs, item) ? null : packs;
  const swipesToTrolley = trolley && !item.ticked;

  // The swipe: a touch drag across the row slides it; a drag down is the page's scroll (touch-action: pan-y).
  const [offset, setOffset] = useState(0);
  const drag = useRef<{ x: number; y: number; start: number; across: boolean | null } | null>(null);
  // A drag that ended over the line's text must not also tick it.
  const dragged = useRef(false);

  const release = () => {
    if (drag.current?.across) setOffset(swipeSettle(offset));
    drag.current = null;
  };

  const row = (
    <>
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
        className={cn("relative flex touch-pan-y transition-transform duration-150", big ? "items-center gap-3.5" : "items-start gap-3", surface)}
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
          if (at.across === null && Math.hypot(dx, dy) > DRAG_SLOP) {
            at.across = Math.abs(dx) > Math.abs(dy);
            // From closed, a drag right is the trolley's (the SwipeRow around this), not the Delete's.
            if (at.across && swipesToTrolley && at.start === 0 && dx > 0) {
              drag.current = null;
              return;
            }
          }
          if (at.across) {
            // The Delete's own drag: kept from the SwipeRow around it, which would otherwise take the pointer.
            event.stopPropagation();
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
        <Checkbox
          checked={item.ticked}
          disabled={busy}
          className={big ? "size-6 rounded-md [&_svg]:size-4" : "mt-3.5"}
          aria-label={label}
          onCheckedChange={(next) => onTick(item.id, next)}
        />
        <div className={cn("flex min-w-0 flex-1 flex-col justify-center py-2", big ? "min-h-14" : "min-h-11")}>
          {/* The text is the tick's bigger target; the checkbox carries the name, so this button stays out of the tab order. */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className={cn("text-left", big && "text-[1.0625rem] leading-snug", item.ticked && "text-fg-subtle line-through")}
            disabled={busy}
            onClick={() => (offset === 0 ? onTick(item.id, !item.ticked) : setOffset(0))}
          >
            {label}
            {plan !== null && <span className="text-fg-subtle" data-testid="shopping-packs">{` → ${packsLabel(plan)}`}</span>}
          </button>
          {meals.length > 0 && (
            <span className={cn("text-fg-subtle", big ? "mt-0.5 text-[0.8125rem]" : "text-sm")} data-testid="shopping-meals">
              {meals.map((meal, index) => (
                <Fragment key={`${meal.name}@${meal.date ?? ""}`}>
                  {index > 0 && " · "}
                  {meal.slug === null ? (
                    mealText(meal)
                  ) : (
                    <RecipeLink slug={meal.slug} className="underline-offset-2 hover:text-fg-normal hover:underline">
                      {mealText(meal)}
                    </RecipeLink>
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
    </>
  );

  return (
    <li className={cn("group relative overflow-hidden", className)} data-testid="shopping-row" data-ticked={item.ticked ? "true" : "false"}>
      {swipesToTrolley ? <SwipeRow right={{ label: "In the trolley", tone: "go", onSwipe: () => onTick(item.id, true) }}>{row}</SwipeRow> : row}
    </li>
  );
}
