import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import type { FileRecipe } from "../../../../domain/import";
import { ingredientCount, stepCount } from "./importSummary";

export type RecipePickerProps = {
  recipes: readonly FileRecipe[];
  busy?: boolean;
  onPick: (index: number) => void;
  onBack: () => void;
};

/** A backup holds a whole collection; one recipe is imported at a time, so it asks which. */
export function RecipePicker({ recipes, busy, onPick, onBack }: RecipePickerProps) {
  return (
    <div className="flex flex-col gap-4" data-source-stage="pick">
      <SectionTitle as="h2">{`That file holds ${recipes.length} recipes`}</SectionTitle>
      <Muted as="p" className="text-sm">
        Pick the one to import. Come back for the next one.
      </Muted>
      <ul className="flex flex-col gap-2">
        {recipes.map((recipe, index) => (
          <li key={`${index}-${recipe.name}`}>
            <button
              type="button"
              data-import-choice={String(index)}
              disabled={busy}
              className="w-full rounded-lg border border-border-normal p-3 text-left hover:bg-bg-subtle disabled:opacity-50"
              onClick={() => onPick(index)}
            >
              <span className="block font-medium">{recipe.name === "" ? "Untitled" : recipe.name}</span>
              <Muted as="span" className="mt-0.5 block text-xs">
                {`${ingredientCount(recipe)} ingredients, ${stepCount(recipe)} steps`}
              </Muted>
            </button>
          </li>
        ))}
      </ul>
      <div>
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
