import { cn } from "@sixthshift/design-system/utils";
import { recipeImageUrl } from "../../../../lib/images";
import { dayParts } from "../../../plan/plan";
import type { ShoppingListMeal } from "../../shopping";

const CHIP =
  "inline-flex h-9 shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full border px-3 font-medium text-sm transition-colors focus-visible:outline-2 focus-visible:outline-border-brand focus-visible:outline-offset-2";
const ON = "border-bg-strong bg-bg-strong text-fg-on-strong";
const OFF = "border-border-normal bg-bg-normal text-fg-normal";

/**
 * The meals the list is for, as a row of chips to flick (decisions.md row
 * 208): All, then each dish with its photo and how many of its lines are
 * still to buy. Pressing one narrows the list to that dish's lines; All, or
 * pressing it again, undoes it. It does the job the Aisles/Meals toggle did
 * on a phone, without leaving the shop's order.
 */
export function MealChips({
  meals,
  left,
  chosen,
  onChoose,
}: {
  meals: readonly ShoppingListMeal[];
  /** Every line still to buy, for All. */
  left: number;
  chosen: string | null;
  onChoose: (key: string | null) => void;
}) {
  return (
    // Bleeds to the screen's edges, as a strip to flick does, and starts in line with the page.
    // A fieldset is a group of controls; min-w-0 undoes its min-content width, so it scrolls rather than widening the page.
    <fieldset
      aria-label="Meals"
      className="-mx-4 flex min-w-0 snap-x gap-2 overflow-x-auto border-0 px-4 pb-1 [scrollbar-width:none]"
      data-testid="shopping-meal-chips"
    >
      <button type="button" aria-pressed={chosen === null} className={cn(CHIP, chosen === null ? ON : OFF)} onClick={() => onChoose(null)}>
        All · {left}
      </button>
      {meals.map((meal) => {
        const image = recipeImageUrl(meal.image);
        const day = meal.date === null ? null : dayParts(meal.date).weekday;
        const on = chosen === meal.key;
        return (
          <button
            key={meal.key}
            type="button"
            aria-pressed={on}
            aria-label={`${meal.name}${day === null ? "" : `, ${day}`}: ${meal.left} to buy`}
            className={cn(CHIP, image !== null && "pl-1", on ? ON : OFF)}
            onClick={() => onChoose(on ? null : meal.key)}
          >
            {image !== null && <img src={image} alt="" loading="lazy" className="size-7 rounded-full object-cover" />}
            <span className="max-w-40 truncate">
              {meal.name}
              {/* The same recipe on two days is two chips, and the day is what tells them apart. */}
              {day !== null && meals.some((other) => other !== meal && other.name === meal.name) && ` ${day}`}
            </span>
            <span className={on ? undefined : "text-fg-subtle"}>· {meal.left === 0 ? "✓" : meal.left}</span>
          </button>
        );
      })}
    </fieldset>
  );
}
