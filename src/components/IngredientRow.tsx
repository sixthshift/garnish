// One ingredient line on the recipe view page. Mealie's order: quantity, unit,
// bold food, with the note dimmed on its own line underneath; a `fixed`
// ingredient (Cooklang `=`) keeps its "fixed" marker regardless of servings.
// A leading checkbox ticks the row off for this session (src/lib/ticks.ts),
// which also strikes the text through. When the page is showing a servings
// count other than the recipe's own, the amount gets a class so it reads as
// "this number changed".
//
// "Scale to..." (M11.5) used to be a per-row link here; M25.2 moved it into
// the servings popover in the ingredients heading (`ScaleControl`, the recipe
// view route), which picks an ingredient from a `Select` rather than acting on
// whichever row it happened to sit on. This row has no scaling control of its
// own.
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Muted } from "@sixthshift/design-system/muted";
import { cn } from "@sixthshift/design-system/utils";
import { formatAmount, formatFood, formatIngredient } from "../domain/format";
import type { Ingredient } from "../domain/recipe";
import { useIngredientTick } from "../lib/ticks";

export type IngredientRowProps = {
  /** The owning recipe's id: ticks.ts keys session state by it. */
  recipeId: string;
  ingredient: Ingredient;
  /** True when the page is showing servings other than the recipe's own. */
  scaled?: boolean;
};

/** The line's visible parts: the amount, the food (bold unless `raw`), and whether `food` is really the untouched original text. Pure. */
export type IngredientLineParts = { amount: string; food: string; raw: boolean };

/**
 * Splits an ingredient into what `IngredientRow` renders with its own markup:
 * the amount (quantity + unit) and the food, kept separate so the food can be
 * bold and the amount can carry the "scaled" class. Mirrors formatIngredient's
 * fallback: a null food with an originalText renders that text verbatim
 * (`raw: true`), unstyled. Pure.
 */
export function ingredientLineParts(ingredient: Pick<Ingredient, "quantity" | "unit" | "food" | "originalText">): IngredientLineParts {
  const { quantity, unit, food, originalText } = ingredient;
  if (food === null && originalText.trim() !== "") return { amount: "", food: originalText.trim(), raw: true };

  const hasQuantity = quantity !== null && quantity !== 0;
  return { amount: hasQuantity ? formatAmount(quantity, unit) : "", food: formatFood(quantity, food), raw: false };
}

export function IngredientRow({ recipeId, ingredient, scaled = false }: IngredientRowProps) {
  const [done, toggle] = useIngredientTick(recipeId, ingredient.id);
  const { amount, food, raw } = ingredientLineParts(ingredient);
  const note = ingredient.note.trim();

  return (
    <li
      className="flex items-start gap-2.5"
      data-testid="ingredient-row"
      data-ticked={done ? "true" : undefined}
      data-fixed={ingredient.fixed ? "true" : undefined}
      data-scaled={scaled ? "true" : undefined}
    >
      <Checkbox checked={done} onCheckedChange={toggle} className="mt-0.5" aria-label={`Tick off ${formatIngredient(ingredient) || "ingredient"}`} />
      <button type="button" onClick={toggle} className={cn("flex flex-1 flex-col gap-0.5 text-left", done && "text-fg-subtle")}>
        <span className={cn(done && "line-through")}>
          {amount !== "" && (
            <span className={cn("tabular-nums", scaled && "font-semibold text-fg-brand")} data-testid="ingredient-amount">
              {amount}{" "}
            </span>
          )}
          {raw ? food : <strong className="font-semibold">{food}</strong>}
          {ingredient.fixed && (
            <Muted as="span" className="ml-1.5 text-xs" title="Fixed amount, does not scale with servings">
              fixed
            </Muted>
          )}
        </span>
        {note !== "" && <Muted as="p" className={cn("text-sm", done && "line-through")}>{note}</Muted>}
      </button>
    </li>
  );
}
