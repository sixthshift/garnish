import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { Toggle } from "@sixthshift/design-system/toggle";
import { Link } from "@tanstack/react-router";
import type { ViewMode } from "../../../../lib/prefs";
import type { RecipeSummary } from "../../recipe";
import { KindToggle } from "../KindToggle";
import { CARD_MIN_WIDTH, RecipeCard } from "./RecipeCard";

/** Cards whose image is fetched eagerly: a phone shows the first and the top of the second. */
const PRIORITY_CARDS = 2;

/** The cards as a grid or a list, each with its Rotation and Weekend toggle under it while marking. */
export function CardList({ recipes, mode, marking }: { recipes: readonly RecipeSummary[]; mode: ViewMode; marking: boolean }) {
  return (
    <ul
      className={mode === "list" ? "flex flex-col gap-3" : "grid gap-4"}
      style={mode === "list" ? undefined : { gridTemplateColumns: `repeat(auto-fill, minmax(min(${CARD_MIN_WIDTH}, 100%), 1fr))` }}
    >
      {recipes.map((recipe, index) => (
        // The slug is where a desktop's flipping finds the card to bring into view (useFlipKeys).
        <li key={recipe.id} data-wall-slug={recipe.slug}>
          <RecipeCard recipe={recipe} mode={mode} priority={index < PRIORITY_CARDS} />
          {marking && (
            <div className="mt-2">
              <KindToggle id={recipe.id} kind={recipe.kind} label={`How you cook ${recipe.name}`} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Marking the library one recipe page at a time is the slow way in; this puts the toggle under every card (decisions.md row 195). */
export function MarkToggle({ marking, onChange }: { marking: boolean; onChange: (marking: boolean) => void }) {
  return (
    <Toggle variant="outline" size="sm" pressed={marking} onPressedChange={onChange}>
      Mark Rotation &amp; Weekend
    </Toggle>
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
