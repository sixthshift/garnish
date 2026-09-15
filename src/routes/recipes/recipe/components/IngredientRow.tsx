// One ingredient line on the recipe view page. Mealie's order: quantity, unit,
// bold food, with the note dimmed on its own line underneath; a `fixed`
// ingredient (Cooklang `=`) keeps its "fixed" marker regardless of servings.
// A leading checkbox ticks the row off for this session (src/lib/ticks.ts),
// which also strikes the text through. When the page is showing a servings
// count other than the recipe's own, the amount gets a class so it reads as
// "this number changed".
//
// A row whose food is made by a recipe (M32.3) renders that food as a link to
// the child rather than bold text, with a quiet "Make N servings" hint under
// it when the two amounts can be related — the parent never inlines the child
// (decisions.md row 70). The link makes the row's body a plain element instead
// of the tick toggle, because an anchor inside a button is not markup: the
// checkbox still ticks, and a sub-recipe row is the one row you cannot tick by
// tapping its text.
//
// In cook mode (`cookFrom` set, StepCard's `size="cook"`), the hint becomes a
// link instead: "Open <child> at N servings", into the child's own cook mode
// at that scale, carrying this recipe's slug as `?from=` so the child's finish
// card can offer a way back (M32.4). The food name still links to the child's
// view page either way — only the hint's destination changes.
//
// "Scale to..." (M11.5) used to be a per-row link here; M25.2 moved it into
// the servings popover in the ingredients heading (`ScaleControl`, the recipe
// view route), which picks an ingredient from a `Select` rather than acting on
// whichever row it happened to sit on. This row has no scaling control of its
// own.
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Muted } from "@sixthshift/design-system/muted";
import { cn } from "@sixthshift/design-system/utils";
import { Link } from "@tanstack/react-router";
import { formatIngredient, formatAmount, formatFood } from "../../../../domain/ingredient";
import { type Ingredient, subRecipeCookLabel, subRecipeHint, subRecipeScale } from "../../../../domain/recipe";
import { useIngredientTick } from "../../../../lib/ticks";
import { useQuickEditIngredient } from "./QuickEdit";
import { useSubRecipe } from "../../../../components/recipe/SubRecipes";

export type IngredientRowProps = {
  /** The owning recipe's id: ticks.ts keys session state by it. */
  recipeId: string;
  ingredient: Ingredient;
  /** True when the page is showing servings other than the recipe's own. */
  scaled?: boolean;
  /**
   * The owning part's id, where the row belongs to exactly one part. Quick
   * edit (M27.5) needs it to find the stored row; a merged summary row can be
   * two parts added together, so it has none and gets no pencil.
   */
  partId?: string;
  /**
   * The parent recipe's slug, set only in cook mode (M32.4). When present, a
   * sub-recipe row's hint is a link into the child's cook mode at the derived
   * servings instead of plain text, carrying this as `?from=`.
   */
  cookFrom?: string;
};

export function IngredientRow({ recipeId, ingredient, scaled = false, partId, cookFrom }: IngredientRowProps) {
  const [done, toggle] = useIngredientTick(recipeId, ingredient.id);
  // The hover pencil (from `md`) and its sheet, or nothing outside the recipe page (M27.5, M29.4).
  const quickEdit = useQuickEditIngredient(partId, ingredient.id);
  // The recipe this row's food is made by, when the page fetched one (M32.3).
  const child = useSubRecipe(ingredient.food);
  const scale = child === null ? null : subRecipeScale(ingredient, child);
  const { amount, food, raw } = ingredientLineParts(ingredient);
  const note = ingredient.note.trim();
  const bodyClass = cn("flex flex-1 flex-col gap-0.5 text-left", done && "text-fg-subtle");

  const line = (
    <span className={cn(done && "line-through")}>
      {amount !== "" && (
        <span className={cn("tabular-nums", scaled && "font-semibold text-fg-brand")} data-testid="ingredient-amount">
          {amount}{" "}
        </span>
      )}
      {raw ? (
        food
      ) : child !== null ? (
        <Link
          to="/recipes/$slug"
          params={{ slug: child.slug }}
          className="font-semibold underline decoration-dotted underline-offset-2"
          data-testid="sub-recipe-link"
        >
          {food}
        </Link>
      ) : (
        <strong className="font-semibold">{food}</strong>
      )}
      {ingredient.fixed && (
        <Muted as="span" className="ml-1.5 text-xs" title="Fixed amount, does not scale with servings">
          fixed
        </Muted>
      )}
    </span>
  );
  const noteLine = note !== "" && <Muted as="p" className={cn("text-sm", done && "line-through")}>{note}</Muted>;

  return (
    <li
      className="group flex items-start gap-2.5"
      data-testid="ingredient-row"
      data-ticked={done ? "true" : undefined}
      data-fixed={ingredient.fixed ? "true" : undefined}
      data-scaled={scaled ? "true" : undefined}
      data-sub-recipe={child !== null ? "true" : undefined}
    >
      <Checkbox checked={done} onCheckedChange={toggle} className="mt-0.5" aria-label={`Tick off ${formatIngredient(ingredient) || "ingredient"}`} />
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
        <button type="button" onClick={toggle} className={bodyClass}>
          {line}
          {noteLine}
        </button>
      )}
      {quickEdit}
    </li>
  );
}

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
