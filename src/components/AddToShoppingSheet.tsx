// "Add to shopping list" (M31.3): the sheet behind the button beside Cook, and
// the same button on cook mode's finish card.
//
// What it lists is the recipe *as the page is showing it* — the caller passes
// the already-scaled document (`scaledForServings`, M25.1), so 8 servings of a
// 4-serving tart offers 400 g of flour, not 200 g. Every row starts ticked to
// include; tapping one excludes it. Part names are headings, following
// `PartIngredients`: the unnamed part gets none, because it is the recipe's
// main body rather than a section of it.
//
// A `skipShopping` food (salt, garlic — always on hand) is not listed at all.
// `mergeIntoList` drops it regardless, so showing it ticked would promise a
// line that never appears, and showing it unticked would offer a control that
// does nothing.
//
// Add hands the included rows to `addToShoppingList` (src/lib/shopping.ts),
// which is where M31.2's merge runs against the current list.
//
// Sheet only paints after mounting on the client, so the list lives in
// `AddToShoppingSheetContent`, which renders anywhere and is what the tests
// exercise.
import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Sheet } from "@sixthshift/design-system/sheet";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { formatIngredient } from "../domain/format";
import type { Ingredient, Recipe } from "../domain/recipe";
import type { ShoppingAddition } from "../domain/shopping";
import { addToShoppingList, addedMessage } from "../lib/shopping";
import { notify, notifyError } from "../lib/notify";

/** One part's buyable ingredients, in page order. `name` is '' for the unnamed part. */
export type ShoppingGroup = { id: string; name: string; ingredients: Ingredient[] };

/** The line a food-less ingredient becomes on the list: its own text, or its formatted self. Pure. */
export function ingredientText(ingredient: Ingredient): string {
  const original = ingredient.originalText.trim();
  return original === "" ? formatIngredient(ingredient).trim() : original;
}

/** False for a row that can never reach the list: an on-hand food, or nothing to name. Pure. */
function buyable(ingredient: Ingredient): boolean {
  if (ingredient.food !== null) return !ingredient.food.skipShopping;
  return ingredientText(ingredient) !== "";
}

/**
 * The sheet's rows, grouped by part: parts in order, each with the ingredients
 * that can reach the list, and empty groups dropped. Pure.
 */
export function shoppingGroups(recipe: Pick<Recipe, "parts">): ShoppingGroup[] {
  return recipe.parts
    .map((part) => ({ id: part.id, name: part.name.trim(), ingredients: part.ingredients.filter(buyable) }))
    .filter((group) => group.ingredients.length > 0);
}

/**
 * The included rows as additions for `mergeIntoList`, at whatever scale the
 * passed recipe is already at, each stamped with this recipe, its part and the
 * servings it was added at. `excluded` holds the ingredient ids tapped off.
 * Pure.
 */
export function additionsFor(recipe: Recipe, excluded: ReadonlySet<string> = new Set()): ShoppingAddition[] {
  const servings = recipe.recipeServings > 0 ? recipe.recipeServings : null;
  return shoppingGroups(recipe).flatMap((group) =>
    group.ingredients
      .filter((ingredient) => !excluded.has(ingredient.id))
      .map((ingredient) => ({
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        food: ingredient.food,
        originalText: ingredientText(ingredient),
        fixed: ingredient.fixed,
        source: { recipeId: recipe.id, recipeName: recipe.name, partName: group.name, servings },
      })),
  );
}

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
  const groups = shoppingGroups(recipe);
  const included = additionsFor(recipe, excluded);

  const toggle = (id: string) =>
    setExcluded((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });

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
                    return (
                      <li
                        key={ingredient.id}
                        className="flex items-start gap-2.5"
                        data-testid="shopping-sheet-row"
                        data-included={on ? "true" : "false"}
                      >
                        <Checkbox checked={on} disabled={busy} className="mt-0.5" aria-label={label} onCheckedChange={() => toggle(ingredient.id)} />
                        <button type="button" disabled={busy} className="flex-1 text-left" onClick={() => toggle(ingredient.id)}>
                          {label}
                        </button>
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
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="solid"
          intent="brand"
          disabled={busy || included.length === 0}
          data-testid="shopping-sheet-add"
          onClick={() => onAdd(included)}
        >
          {busy ? "Adding…" : "Add"}
        </Button>
      </Sheet.Footer>
    </>
  );
}

export type AddToShoppingSheetProps = AddToShoppingSheetContentProps & { open: boolean };

export function AddToShoppingSheet({ open, ...props }: AddToShoppingSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && props.onCancel()} size="sm" closable aria-label="Add to shopping list">
      <AddToShoppingSheetContent {...props} />
    </Sheet>
  );
}

/** The list page (M31.4). */
export const SHOPPING_PATH = "/shopping";

export type AddToShoppingButtonProps = {
  /** The recipe as the page is showing it: already scaled. */
  recipe: Recipe;
  size?: "sm" | "md";
};

/**
 * The button and its sheet: the recipe page's header action and cook mode's
 * finish card use the same one. The toast says how many lines the list gained
 * and offers a way to it.
 */
export function AddToShoppingButton({ recipe, size = "sm" }: AddToShoppingButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const add = async (additions: ShoppingAddition[]) => {
    setBusy(true);
    try {
      const added = await addToShoppingList(additions);
      setOpen(false);
      notify({
        intent: "success",
        title: addedMessage(added),
        // The Toaster is not the router's business, so the caller navigates:
        // this button is always rendered inside a route (M31.4).
        action: { label: "View list", onSelect: () => void router.navigate({ to: SHOPPING_PATH }) },
      });
    } catch (error) {
      notifyError("Couldn't add to the shopping list", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        intent="neutral"
        size={size}
        data-testid="shopping-list-button"
        data-print="hide"
        onClick={() => setOpen(true)}
      >
        Add to shopping list
      </Button>
      <AddToShoppingSheet open={open} recipe={recipe} busy={busy} onCancel={() => setOpen(false)} onAdd={(additions) => void add(additions)} />
    </>
  );
}
