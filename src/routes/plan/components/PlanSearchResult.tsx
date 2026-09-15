import type { RecipeSummary } from "../../../domain/recipe";
import { recipeImageUrl } from "../../../lib/images";
import { EntryImage } from "./EntryImage";

/** One result in the add row: small, no link — clicking it plans the recipe rather than opening it. */
export function PlanSearchResult({ recipe }: { recipe: RecipeSummary }) {
  return (
    <div className="flex w-full cursor-pointer items-center gap-2 rounded-md p-1 text-left text-sm hover:bg-bg-normal-hovered" data-testid="plan-result">
      <EntryImage src={recipeImageUrl(recipe.image)} />
      <span className="min-w-0 flex-1 truncate">{recipe.name}</span>
    </div>
  );
}
