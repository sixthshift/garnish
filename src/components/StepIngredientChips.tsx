// The ingredients a step mentions, as chips under it (M26.1). Cook mode shows
// them on every step card; the view page shows them only below `md`, where the
// ingredient list has scrolled away, and hides them from `md`, where the list
// is sitting beside the method already.
//
// The match is computed, never stored (src/domain/stepIngredients.ts,
// decisions.md row 22). Each chip is a button on the same session ticks as the
// ingredient rows (src/lib/ticks.ts), so ticking "2 eggs" here strikes the row
// through in the list and in the phone sheet too.
import { Badge } from "@sixthshift/design-system/badge";
import { cn } from "@sixthshift/design-system/utils";
import { formatAmount, formatFood } from "../domain/format";
import type { Ingredient } from "../domain/recipe";
import { ingredientsInStep } from "../domain/stepIngredients";
import { useIngredientTick } from "../lib/ticks";

/** "2 eggs", "200 g flour", "salt" — the amount without its unit when there is no quantity, as the lines do. */
export function chipLabel(ingredient: Ingredient): string {
  const { quantity, unit, food } = ingredient;
  const hasQuantity = quantity !== null && quantity !== 0;
  return [hasQuantity ? formatAmount(quantity, unit) : "", formatFood(quantity, food)]
    .filter((part) => part !== "")
    .join(" ");
}

function StepIngredientChip({ recipeId, ingredient }: { recipeId: string; ingredient: Ingredient }) {
  const [done, toggle] = useIngredientTick(recipeId, ingredient.id);
  const label = chipLabel(ingredient);
  return (
    <li>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={done}
        aria-label={`Tick off ${label || "ingredient"}`}
        data-testid="step-ingredient-chip"
        data-ticked={done ? "true" : undefined}
      >
        <Badge variant="soft" intent={done ? "muted" : "neutral"} className={cn(done && "line-through opacity-60")}>
          {label}
        </Badge>
      </button>
    </li>
  );
}

export type StepIngredientChipsProps = {
  recipeId: string;
  /** The step's text, matched against the names below. */
  text: string;
  /** The owning part's ingredients; only these can match. */
  ingredients: Ingredient[];
  className?: string;
};

/** The step's ingredients as tickable chips, or nothing when it names none. */
export function StepIngredientChips({ recipeId, text, ingredients, className }: StepIngredientChipsProps) {
  const hits = ingredientsInStep(text, ingredients);
  if (hits.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Ingredients in this step" data-testid="step-ingredients">
      {hits.map((ingredient) => (
        <StepIngredientChip key={ingredient.id} recipeId={recipeId} ingredient={ingredient} />
      ))}
    </ul>
  );
}
