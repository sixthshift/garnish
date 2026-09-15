import { Popover } from "@sixthshift/design-system/popover";
import { useState } from "react";
import { NumberStepper } from "../../../../components/ui/NumberStepper";
import { dayLabel, type PlanEntryInput, todayIso } from "../../../../domain/plan";
import type { Recipe } from "../../../../domain/recipe";
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
  // route hands `RecipeActions`, so this is whatever the page is
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
      {/* An invisible trigger: the menu item that opens this unmounts when chosen, so the popover anchors to this span in RecipeActions' relative box. */}
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
 * so the entry still reads as what was planned after the recipe is
 * renamed or deleted. Pure.
 */
export function planEntryFor(recipe: Pick<Recipe, "id" | "name">, date: string, servings: number): PlanEntryInput {
  return { date, recipeId: recipe.id, text: recipe.name, servings };
}
