// One ingredient line on the recipe view page; the editor's row is components/IngredientEditRow.tsx.

import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Muted } from "@sixthshift/design-system/muted";
import { cn } from "@sixthshift/design-system/utils";
import { Link } from "@tanstack/react-router";
import { useSubRecipe } from "../../../../components/recipe/SubRecipes";
import { useIngredientTick } from "../../../../lib/useTicks";
import { formatIngredient, inflectIngredient } from "../../ingredient";
import { alternativeText, type Ingredient, subRecipeHint, subRecipeScale } from "../../recipe";
import { useCooking } from "../cooking/CookingContext";
import { TonightMark } from "../cooking/TonightMark";
import { LIT, useIngredientLink } from "./StepLinks";
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
};

export function IngredientRow({ recipeId, ingredient, scaled = false, partId }: IngredientRowProps) {
  const [done, toggle] = useIngredientTick(recipeId, ingredient.id);
  // Changed tonight, while the page is cooked from (decisions.md row 214).
  const cooking = useCooking();
  const mark = cooking?.marks.get(ingredient.id);
  // The quick-edit pencil and its sheet, or nothing outside the recipe page.
  const quickEdit = useQuickEditIngredient(partId, ingredient.id);
  // The recipe this row's food is made by, when the page fetched one.
  const child = useSubRecipe(ingredient.food);
  // Lit with the steps that use it, on a desktop's recipe (StepLinks.tsx). A
  // row without a part (merged, or repeated in a step card) takes no part.
  const link = useIngredientLink(partId === undefined ? undefined : ingredient.id);
  const scale = child === null ? null : subRecipeScale(ingredient, child);
  // Tokens, so the food can be bold and the amount can carry the "scaled" class.
  const tokens = inflectIngredient(ingredient);
  const amount = tokens.raw ? "" : [tokens.quantity, tokens.unit].filter((part) => part !== "").join(" ");
  const note = ingredient.note.trim();
  const bodyClass = cn("flex flex-1 flex-col gap-0.5 text-left", done && "text-fg-subtle");

  const line = (
    <span className={cn((done || mark?.leftOut) && "line-through")}>
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
          // Opens the child at the servings this line needs of it (subRecipeScale).
          search={scale === null ? undefined : { servings: Number(scale.toFixed(2)) }}
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
  const tonight = mark !== undefined && <TonightMark mark={mark} was={cooking?.was.get(ingredient.id)} />;
  const noteLine = note !== "" && (
    <Muted as="p" className={cn("text-sm", done && "line-through")}>
      {note}
    </Muted>
  );
  // What it can be made with instead, at this line's amount (decisions.md row 199).
  // Spans, not a list: on an ordinary row this sits inside the row's button.
  const alternativeLines = ingredient.alternatives.length > 0 && (
    <Muted as="span" className={cn("flex flex-col text-sm", done && "line-through")} data-testid="ingredient-alternatives">
      {ingredient.alternatives.map((alt, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: read-only, in stored order
        <span key={index}>
          or {alternativeText(ingredient, alt)}
          {alt.note !== "" && ` · ${alt.note}`}
        </span>
      ))}
    </Muted>
  );

  return (
    <li
      className={cn("group/quick-edit flex items-start gap-2.5", link.linking && "-mx-2 rounded-md px-2 py-0.5 transition-colors", link.lit && LIT)}
      {...link.props}
      data-lit={link.lit ? "true" : undefined}
      data-testid="ingredient-row"
      data-ticked={done ? "true" : undefined}
      data-fixed={ingredient.fixed ? "true" : undefined}
      data-scaled={scaled ? "true" : undefined}
      data-sub-recipe={child !== null ? "true" : undefined}
      data-tonight={mark === undefined ? undefined : mark.adjustment.kind}
    >
      <Checkbox checked={done} onCheckedChange={toggle} className="mt-0.5" aria-label={`Tick off ${formatIngredient(ingredient) || "ingredient"}`} />
      {child !== null ? (
        <div className={bodyClass}>
          <span>
            {line}
            {tonight}
          </span>
          {noteLine}
          {alternativeLines}
          {scale !== null && (
            <Muted as="p" className="text-xs" data-testid="sub-recipe-hint">
              {subRecipeHint(scale)}
            </Muted>
          )}
        </div>
      ) : (
        <button type="button" onClick={toggle} className={bodyClass}>
          <span>
            {line}
            {tonight}
          </span>
          {noteLine}
          {alternativeLines}
        </button>
      )}
      {quickEdit}
    </li>
  );
}
