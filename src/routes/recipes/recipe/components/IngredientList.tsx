// The ingredient lists the recipe page shows: one flat list of rows, and one
// part's list under the part's name. Lifted out of the view route (M24.6) so
// the phone's ingredients sheet renders exactly the same markup — the same
// `IngredientRow`s, reading the same ticks — rather than a second copy of it.
import { SectionTitle } from "@sixthshift/design-system/section-title";
import type { Ingredient, Part } from "../../../../domain/recipe";
import { IngredientRow } from "./IngredientRow";

export type IngredientListProps = {
  ingredients: Ingredient[];
  /** The owning recipe's id: ticks are keyed by it (src/lib/ticks.ts). */
  recipeId: string;
  /** True when the page is showing servings other than the recipe's own. */
  scaled?: boolean;
  /** The owning part's id, passed to each row for quick edit (M27.5). Absent for the merged summary list. */
  partId?: string;
};

export function IngredientList({ ingredients, recipeId, scaled = false, partId }: IngredientListProps) {
  return (
    <ul className="flex flex-col gap-2" aria-label="Ingredients">
      {ingredients.map((ingredient) => (
        <IngredientRow key={ingredient.id} recipeId={recipeId} ingredient={ingredient} scaled={scaled} partId={partId} />
      ))}
    </ul>
  );
}

export type PartIngredientsProps = Omit<IngredientListProps, "ingredients" | "partId"> & { part: Part };

/**
 * One part's ingredients, under the part's name. The unnamed part — a flat
 * recipe's only part, or the main body beside named ones — has no heading, as
 * in Mealie. A part with no ingredients contributes nothing. Structured mode
 * only: summary mode shows one merged list instead.
 */
export function PartIngredients({ part, ...rest }: PartIngredientsProps) {
  const name = part.name.trim();
  if (part.ingredients.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" aria-label={name === "" ? undefined : `${name} ingredients`}>
      {name !== "" && <SectionTitle as="h2">{name}</SectionTitle>}
      <IngredientList ingredients={part.ingredients} partId={part.id} {...rest} />
    </section>
  );
}
