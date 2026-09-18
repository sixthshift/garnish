import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Sheet } from "@sixthshift/design-system/sheet";
import { useState } from "react";
import { formatIngredient } from "../../domain/ingredient";
import { type Ingredient, type Recipe, type SubRecipe, subRecipeScale } from "../../domain/recipe";
import { additionsForWithSubRecipes, ingredientText, type ShoppingAddition, shoppingGroups } from "../../domain/shopping";
import { toastError } from "../../lib/toast";
import { getRecipe } from "../../server/fns/recipes";
import { useSubRecipes } from "../recipe/SubRecipes";

export type AddToShoppingSheetContentProps = {
  /** The recipe as the page is showing it: already scaled. */
  recipe: Recipe;
  /** Called with the rows still ticked, in page order. */
  onAdd: (additions: ShoppingAddition[]) => void;
  onCancel: () => void;
  busy?: boolean;
};

export function AddToShoppingSheetContent({ recipe, onAdd, onCancel, busy = false }: AddToShoppingSheetContentProps) {
  // Excluded rather than included: every row starts ticked, so the empty set is
  // the default state and nothing has to be seeded from the recipe.
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  // Rows with "Add <child>'s ingredients instead" selected, and the
  // already-scaled child documents fetched for them, keyed by the row's own
  // ingredient id (a child can be linked from more than one row, each at its
  // own derived scale). `loadingChild` gates a second tap and the Add button
  // while a fetch for that row is in flight.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [childRecipes, setChildRecipes] = useState<Readonly<Record<string, Recipe>>>({});
  const [loadingChild, setLoadingChild] = useState<ReadonlySet<string>>(new Set());
  const subRecipes = useSubRecipes();
  const groups = shoppingGroups(recipe);
  const included = additionsForWithSubRecipes(recipe, excluded, expanded, subRecipes, childRecipes);
  const busyAdding = busy || loadingChild.size > 0;

  const toggle = (id: string) =>
    setExcluded((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const toggleExpand = async (ingredient: Ingredient, child: SubRecipe) => {
    const wasExpanded = expanded.has(ingredient.id);
    setExpanded((previous) => {
      const next = new Set(previous);
      if (wasExpanded) next.delete(ingredient.id);
      else next.add(ingredient.id);
      return next;
    });
    if (wasExpanded || childRecipes[ingredient.id] !== undefined) return;
    const servings = subRecipeScale(ingredient, child);
    if (servings === null) return; // nothing to fetch: subRecipeAdditions falls back to the row itself
    setLoadingChild((previous) => new Set(previous).add(ingredient.id));
    try {
      const doc = await getRecipe({ data: { slug: child.slug, servings } });
      setChildRecipes((previous) => ({ ...previous, [ingredient.id]: doc }));
    } catch (error) {
      toastError(`Couldn't load ${child.name}`, error);
      setExpanded((previous) => {
        const next = new Set(previous);
        next.delete(ingredient.id);
        return next;
      });
    } finally {
      setLoadingChild((previous) => {
        const next = new Set(previous);
        next.delete(ingredient.id);
        return next;
      });
    }
  };

  return (
    <>
      <Sheet.Header>
        <h2 className="text-base font-medium">Add to shopping list</h2>
      </Sheet.Header>
      <Sheet.Body>
        {groups.length === 0 ? (
          <Muted>Nothing to add: this recipe has no ingredients to buy.</Muted>
        ) : (
          <div className="flex flex-col gap-5" data-testid="shopping-sheet-rows">
            {groups.map((group) => (
              <section key={group.id} className="flex flex-col gap-3" aria-label={group.name === "" ? undefined : group.name}>
                {group.name !== "" && <SectionTitle as="h3">{group.name}</SectionTitle>}
                <ul className="flex flex-col gap-2">
                  {group.ingredients.map((ingredient) => {
                    const label = formatIngredient(ingredient).trim() || ingredientText(ingredient);
                    const on = !excluded.has(ingredient.id);
                    const child = ingredient.food?.recipeId ? (subRecipes.get(ingredient.food.recipeId) ?? null) : null;
                    const useChild = expanded.has(ingredient.id);
                    const rowLoading = loadingChild.has(ingredient.id);
                    return (
                      <li
                        key={ingredient.id}
                        className="flex flex-col gap-1"
                        data-testid="shopping-sheet-row"
                        data-included={on ? "true" : "false"}
                        data-sub-recipe={child !== null ? "true" : undefined}
                        data-sub-recipe-expanded={useChild ? "true" : undefined}
                      >
                        <div className="flex items-start gap-2.5">
                          <Checkbox checked={on} disabled={busyAdding} className="mt-0.5" aria-label={label} onCheckedChange={() => toggle(ingredient.id)} />
                          <button type="button" disabled={busyAdding} className="flex-1 text-left" onClick={() => toggle(ingredient.id)}>
                            {label}
                          </button>
                        </div>
                        {child !== null && (
                          <button
                            type="button"
                            disabled={busyAdding || !on}
                            data-testid="shopping-sheet-subrecipe-toggle"
                            className="ml-7 self-start text-xs font-medium text-fg-brand underline decoration-dotted underline-offset-2 disabled:opacity-50"
                            onClick={() => void toggleExpand(ingredient, child)}
                          >
                            {rowLoading ? "Loading…" : useChild ? `Add ${label} instead` : `Add ${child.name}'s ingredients instead`}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Sheet.Body>
      <Sheet.Footer>
        <Button type="button" variant="ghost" intent="neutral" disabled={busyAdding} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="solid"
          intent="brand"
          disabled={busyAdding || included.length === 0}
          data-testid="shopping-sheet-add"
          onClick={() => onAdd(included)}
        >
          {busy ? "Adding…" : "Add"}
        </Button>
      </Sheet.Footer>
    </>
  );
}
