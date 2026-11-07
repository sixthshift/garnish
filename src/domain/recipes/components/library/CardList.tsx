import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { Toggle } from "@sixthshift/design-system/toggle";
import { Link } from "@tanstack/react-router";
import type { ViewMode } from "../../../../lib/prefs";
import type { RecipeSummary } from "../../recipe";
import { MarkChooser, MarkUnder } from "../facets/MarkUnder";
import { type Marking, START_MARKING } from "../facets/marking";
import { CARD_MIN_WIDTH, RecipeCard } from "./RecipeCard";

/** Cards whose image is fetched eagerly: a phone shows the first and the top of the second. */
const PRIORITY_CARDS = 2;

/** The cards as a grid or a list, each with what is being marked under it while marking. */
export function CardList({ recipes, mode, marking }: { recipes: readonly RecipeSummary[]; mode: ViewMode; marking: Marking | null }) {
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
              <MarkUnder recipe={recipe} marking={marking} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Marking the library one recipe page at a time is the slow way in; this puts
 * a toggle under every card (decisions.md row 195): Rotation and Weekend, or
 * one value of one layer of what a recipe is (row 209), chosen beside it.
 */
export function MarkToggle({ marking, onChange }: { marking: Marking | null; onChange: (marking: Marking | null) => void }) {
  return (
    <>
      {marking && <MarkChooser marking={marking} onChange={onChange} className="w-56" />}
      <Toggle variant="outline" size="sm" pressed={marking !== null} onPressedChange={(on) => onChange(on ? START_MARKING : null)}>
        {marking ? "Done marking" : "Mark recipes"}
      </Toggle>
    </>
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
