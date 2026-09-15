// "Plan" (M33.4): the recipe page's action menu gains this alongside "Make
// this a food" (M32.3) — a popover offering the next seven days (today
// first) and a servings stepper defaulting to the page's scale (the scaled
// `recipe` prop the route already passes to `RecipeActions`, M25.1). Choosing
// a day writes one plan entry through `addPlanEntry` (M33.1), copying the
// recipe's name into `text` the way the plan page's own add row does
// (M33.2, `src/routes/plan/Plan.tsx`): the entry still reads as what was planned
// once the recipe is renamed or deleted.
//
// `Popover.Body` only paints on the client (it portals through
// `FloatingPortal`, which needs `document`), so the day list and stepper live
// in `PlanPopoverContent`, which renders anywhere and is what the tests
// exercise — the same split `AddToShoppingSheetContent` and
// `MadeThisSheetContent` use for their own overlays.
//
// The popover's `Trigger` is an invisible span rather than the menu item
// itself: the design system's `Popover` needs a `Trigger` to float against,
// but the action menu's panel (and everything in it, including the "Plan"
// item) unmounts the instant an item is chosen — anchoring to the item would
// lose its reference node at the exact moment the popover is meant to open.
// `RecipeActions` wraps the menu and this trigger in one `relative` box, so
// the invisible span sits where the "…" button is; opening is driven by the
// menu item's `onSelect` through the controlled `open`/`onOpenChange` pair,
// not by a click on the trigger itself.
import { Popover } from "@sixthshift/design-system/popover";
import { useState } from "react";
import { dayLabel, todayIso, type PlanEntryInput } from "../../../../domain/plan";
import { type Recipe } from "../../../../domain/recipe";
import { NumberStepper } from "../../../../components/ui/NumberStepper";
import { nextSevenDays } from "../../../../lib/dates";

export type PlanPopoverRecipe = Pick<Recipe, "id" | "name" | "recipeServings">;

export type PlanPopoverContentProps = {
  recipe: PlanPopoverRecipe;
  /** Called with the chosen day and the stepper's current value. */
  onChoose: (date: string, servings: number) => void;
  busy?: boolean;
  /** Injected so a render test does not move with the clock. */
  today?: string;
};

export function PlanPopoverContent({ recipe, onChoose, busy = false, today = todayIso() }: PlanPopoverContentProps) {
  // Defaults to the page's scale: `recipe` is the already-scaled document the
  // route hands `RecipeActions` (M25.1), so this is whatever the page is
  // currently showing, not the recipe's own stored servings.
  const [servings, setServings] = useState(() => (recipe.recipeServings > 0 ? Number(recipe.recipeServings.toFixed(2)) : 1));
  const days = nextSevenDays(today);

  return (
    <div className="flex flex-col gap-3" data-testid="plan-popover">
      <NumberStepper label="Servings" value={servings} min={1} disabled={busy} onChange={setServings} />
      <ul className="flex flex-col gap-1" aria-label="Plan for a day">
        {days.map((date, index) => (
          <li key={date}>
            <button
              type="button"
              disabled={busy}
              data-testid="plan-popover-day"
              data-date={date}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-bg-normal-hovered disabled:opacity-50"
              onClick={() => onChoose(date, servings)}
            >
              <span>{dayLabel(date)}</span>
              {index === 0 && <span className="text-xs text-fg-subtle">Today</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type PlanPopoverProps = {
  recipe: PlanPopoverRecipe;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (date: string, servings: number) => void;
  busy?: boolean;
};

/** The popover itself: see the file header for why the trigger is an invisible anchor rather than the menu item. */
export function PlanPopover({ recipe, open, onOpenChange, onChoose, busy = false }: PlanPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange} placement="bottom-end">
      <Popover.Trigger asChild>
        <span aria-hidden="true" className="pointer-events-none absolute inset-0" />
      </Popover.Trigger>
      <Popover.Body className="w-64 p-3" aria-label={`Plan ${recipe.name}`}>
        <PlanPopoverContent recipe={recipe} onChoose={onChoose} busy={busy} />
      </Popover.Body>
    </Popover>
  );
}

/**
 * What choosing `date` at `servings` sends to `addPlanEntry`: the recipe's id
 * and its name copied into `text`, the way the plan page's own add row does
 * (M33.2) so the entry still reads as what was planned after the recipe is
 * renamed or deleted. Pure.
 */
export function planEntryFor(recipe: Pick<Recipe, "id" | "name">, date: string, servings: number): PlanEntryInput {
  return { date, recipeId: recipe.id, text: recipe.name, servings };
}
