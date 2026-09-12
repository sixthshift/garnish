// The ingredients, reachable from the method on a phone (M24.6). Below `md`
// the two columns stack, so by the time you are reading step four the lists
// are a long way up the page; a small fixed button over the tab bar opens them
// in a sheet instead of sending you back up.
//
// It is the same content as the aside, not a copy: summary mode shows the one
// merged list, structured mode each part's list under its name, and the rows
// are `IngredientRow`s reading the same session ticks (src/lib/ticks.ts), so
// ticking here strikes the row on the page through too.
//
// Sheet only paints after mounting on the client, so the body lives in
// `IngredientsSheetContent`, which renders anywhere and is what the tests
// exercise.
import { Sheet } from "@sixthshift/design-system/sheet";
import { IngredientList, PartIngredients } from "./IngredientList";
import { mergeIngredients } from "../domain/merge";
import type { Recipe } from "../domain/recipe";

export type IngredientsSheetContentProps = {
  recipe: Recipe;
  /** True for one merged list, false for a list per part. */
  summary: boolean;
  /** True when the page is showing servings other than the recipe's own. */
  scaled?: boolean;
};

export function IngredientsSheetContent({ recipe, summary, scaled = false }: IngredientsSheetContentProps) {
  return (
    <>
      <Sheet.Header>
        <h2 className="text-base font-medium">Ingredients</h2>
      </Sheet.Header>
      <Sheet.Body>
        <div className="flex flex-col gap-6" data-testid="ingredients-sheet-lists">
          {summary ? (
            <IngredientList ingredients={mergeIngredients(recipe)} recipeId={recipe.id} scaled={scaled} />
          ) : (
            recipe.parts.map((part) => <PartIngredients key={part.id} part={part} recipeId={recipe.id} scaled={scaled} />)
          )}
        </div>
      </Sheet.Body>
    </>
  );
}

export type IngredientsSheetProps = IngredientsSheetContentProps & { open: boolean; onClose: () => void };

export function IngredientsSheet({ open, onClose, ...props }: IngredientsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()} size="sm" closable aria-label="Ingredients">
      <IngredientsSheetContent {...props} />
    </Sheet>
  );
}
