import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { Link } from "@tanstack/react-router";
import type { ViewMode } from "../../../../lib/prefs";
import type { RecipeSummary } from "../../recipe";
import { CARD_MIN_WIDTH, RecipeCard } from "./RecipeCard";

/** Cards whose image is fetched eagerly: a phone shows the first and the top of the second. */
const PRIORITY_CARDS = 2;

/** The cards as a grid or a list. */
export function CardList({ recipes, mode }: { recipes: readonly RecipeSummary[]; mode: ViewMode }) {
  return (
    <ul
      className={mode === "list" ? "flex flex-col gap-3" : "grid gap-4"}
      style={mode === "list" ? undefined : { gridTemplateColumns: `repeat(auto-fill, minmax(min(${CARD_MIN_WIDTH}, 100%), 1fr))` }}
    >
      {recipes.map((recipe, index) => (
        // The slug is where a desktop's flipping finds the card to bring into view (useFlipKeys).
        <li key={recipe.id} data-wall-slug={recipe.slug}>
          <RecipeCard recipe={recipe} mode={mode} priority={index < PRIORITY_CARDS} />
        </li>
      ))}
    </ul>
  );
}

/** What the list shows when there is nothing to list: a search or filters that matched nothing, or no recipes yet. */
export function LibraryEmpty({ filtered }: { filtered: boolean }) {
  if (filtered) {
    return (
      <div className="flex flex-col items-start gap-3 py-8">
        <Muted as="p">No recipes match that search.</Muted>
        <Button asChild variant="outline" intent="neutral">
          <Link to="/recipes" search={{}}>
            Clear filters
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-3 py-8">
      <Muted as="p">No recipes yet.</Muted>
      <Button asChild intent="brand">
        <Link to="/recipes/new">Add your first recipe</Link>
      </Button>
    </div>
  );
}
