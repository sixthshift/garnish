// One ingredient line on the recipe view page; the editor's row is components/IngredientEditRow.tsx.

import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Muted } from "@sixthshift/design-system/muted";
import { cn } from "@sixthshift/design-system/utils";
import { Link } from "@tanstack/react-router";
import { useSubRecipe } from "../../../../components/recipe/SubRecipes";
import { formatIngredient, inflectIngredient } from "../../../../domain/ingredient";
import { type Ingredient, subRecipeCookLabel, subRecipeHint, subRecipeScale } from "../../../../domain/recipe";
import { useIngredientTick } from "../../../../lib/useTicks";
import { useQuickEditIngredient } from "./useQuickEdit";

export type IngredientRowProps = {
  /** The owning recipe's id: ticks.ts keys session state by it. */
  recipeId: string;
  ingredient: Ingredient;
  /** True when the page is showing servings other than the recipe's own. */
  scaled?: boolean;
  /**
   * The owning part's id, where the row belongs to exactly one part. Quick
   * edit needs it to find the stored row; a merged summary row can be
   * two parts added together, so it has none and gets no pencil.
   */
  partId?: string;
  /**
   * The parent recipe's slug, set only in cook mode. When present, a
   * sub-recipe row's hint is a link into the child's cook mode at the derived
   * servings instead of plain text, carrying this as `?from=`.
   */
  cookFrom?: string;
  /** `cook` makes the whole row a 48px target, as cook mode's deck needs (`CookIngredientItem` does the same). */
  size?: "page" | "cook";
};

export function IngredientRow({ recipeId, ingredient, scaled = false, partId, cookFrom, size = "page" }: IngredientRowProps) {
  const cook = size === "cook";
  const [done, toggle] = useIngredientTick(recipeId, ingredient.id);
  // The hover pencil (from `md`) and its sheet, or nothing outside the recipe page.
  const quickEdit = useQuickEditIngredient(partId, ingredient.id);
  // The recipe this row's food is made by, when the page fetched one.
  const child = useSubRecipe(ingredient.food);
  const scale = child === null ? null : subRecipeScale(ingredient, child);
  // Tokens, so the food can be bold and the amount can carry the "scaled" class.
  const tokens = inflectIngredient(ingredient);
  const amount = tokens.raw ? "" : [tokens.quantity, tokens.unit].filter((part) => part !== "").join(" ");
  const note = ingredient.note.trim();
  const bodyClass = cn("flex flex-1 flex-col gap-0.5 text-left", cook && "justify-center", done && "text-fg-subtle");

  const line = (
    <span className={cn(done && "line-through")}>
      {amount !== "" && (
        <span className={cn("tabular-nums", scaled && "font-semibold text-fg-brand")} data-testid="ingredient-amount">
          {amount}{" "}
        </span>
      )}
      {tokens.raw ? (
        tokens.text
      ) : child !== null ? (
        <Link
          to="/recipes/$slug"
          params={{ slug: child.slug }}
          className="font-semibold underline decoration-dotted underline-offset-2"
          data-testid="sub-recipe-link"
        >
          {tokens.food}
        </Link>
      ) : (
        <strong className="font-semibold">{tokens.food}</strong>
      )}
      {ingredient.fixed && (
        <Muted as="span" className="ml-1.5 text-xs" title="Fixed amount, does not scale with servings">
          fixed
        </Muted>
      )}
    </span>
  );
  const noteLine = note !== "" && (
    <Muted as="p" className={cn("text-sm", done && "line-through")}>
      {note}
    </Muted>
  );

  return (
    <li
      className={cn("group flex items-start gap-2.5", cook && "relative gap-3")}
      data-testid="ingredient-row"
      data-ticked={done ? "true" : undefined}
      data-fixed={ingredient.fixed ? "true" : undefined}
      data-scaled={scaled ? "true" : undefined}
      data-sub-recipe={child !== null ? "true" : undefined}
    >
      <Checkbox
        checked={done}
        onCheckedChange={toggle}
        className={cook ? COOK_TICK : "mt-0.5"}
        aria-label={`Tick off ${formatIngredient(ingredient) || "ingredient"}`}
      />
      {child !== null ? (
        <div className={bodyClass}>
          {line}
          {noteLine}
          {scale !== null && cookFrom === undefined && (
            <Muted as="p" className="text-xs" data-testid="sub-recipe-hint">
              {subRecipeHint(scale)}
            </Muted>
          )}
          {scale !== null && cookFrom !== undefined && (
            <Link
              to="/recipes/$slug/cook"
              params={{ slug: child.slug }}
              search={{ servings: Number(scale.toFixed(2)), from: cookFrom }}
              className="text-xs font-medium text-fg-brand underline decoration-dotted underline-offset-2"
              data-testid="sub-recipe-cook-link"
            >
              {subRecipeCookLabel(scale, child.name)}
            </Link>
          )}
        </div>
      ) : (
        <button type="button" onClick={toggle} className={cn(bodyClass, cook && COOK_ROW_BUTTON)}>
          {line}
          {noteLine}
        </button>
      )}
      {quickEdit}
    </li>
  );
}

/**
 * Cook mode's row, a 48px target edge to edge: the text button's overlay
 * (`COOK_ROW_BUTTON`) stretches over the whole `relative` row, and the tick
 * box sits above it, its own press area grown to 48px square so a wet finger
 * aimed at the box gets the box. The box's top is where the first line of a
 * `min-h-12 py-2` text button is centred.
 */
export const COOK_TICK = "relative z-10 mt-4 shrink-0 after:absolute after:-inset-4 after:content-['']";
export const COOK_ROW_BUTTON = "min-h-12 py-2 after:absolute after:inset-0 after:content-['']";
