import { Button } from "@sixthshift/design-system/button";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Heading } from "@sixthshift/design-system/heading";
import { Muted } from "@sixthshift/design-system/muted";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useMemo } from "react";
import { DiceIcon } from "../../../../../components/ui/icons";
import { useViewMode } from "../../../../../lib/prefs";
import type { RecipeSummary } from "../../../recipe";
import type { Marking } from "../../facets/marking";
import { CardList, LibraryEmpty, MarkToggle } from "../CardList";
import { ViewModeToggle } from "../ViewModeToggle";
import { PhotoWall } from "./PhotoWall";
import { useFlipKeys } from "./useFlipKeys";

/** A wall shows a row of five or more at once: their photos are fetched first. */
const PRIORITY_WALL = 6;

export type DesktopLibraryProps = {
  recipes: readonly RecipeSummary[];
  /** The recipe open in the side panel, the third pane. */
  open: string | undefined;
  /** A search or a filter is set: an empty wall offers to clear it. */
  filtered: boolean;
  marking: Marking | null;
  onMarkingChange: (marking: Marking | null) => void;
  onDice: () => void;
  /** The filters column (FiltersColumn). */
  filters: ReactNode;
};

/**
 * A desktop's library in three panes (decisions.md row 207): the filters down
 * the left, the wall of photos in the middle, and the recipe a card opens in
 * the side panel beside them (RecipePanel), which the arrow keys flip through.
 * A screen tall, each pane scrolling on its own. The list view stays; the grid
 * becomes the wall.
 */
export function DesktopLibrary({ recipes, open, filtered, marking, onMarkingChange, onDice, filters }: DesktopLibraryProps) {
  const [viewMode] = useViewMode();
  const slugs = useMemo(() => recipes.map((recipe) => recipe.slug), [recipes]);
  useFlipKeys(slugs);
  const flipping = open !== undefined && slugs.includes(open);

  return (
    <div className="grid h-[calc(100dvh-var(--top-bar))] grid-cols-[15.5rem_minmax(0,1fr)]" data-testid="library-panes">
      {filters}
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 pt-5 pb-10" data-testid="wall-pane">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-page-header="">
          <Heading as="h1">Recipes</Heading>
          <div className="flex flex-col">
            <Muted as="p" className="whitespace-nowrap">
              {recipes.length === 1 ? "1 recipe" : `${recipes.length} recipes`}
            </Muted>
            {/* Said where it is seen, so the keys are not a secret; a pointer flips by clicking the next card. */}
            {flipping && (
              <Muted as="p" className="whitespace-nowrap text-xs" data-testid="flip-hint">
                ← → to flip, Enter to open
              </Muted>
            )}
          </div>
          <div className="flex-1" />
          <MarkToggle marking={marking} onChange={onMarkingChange} />
          <ViewModeToggle />
          <Button iconOnly variant="outline" intent="neutral" size="sm" aria-label="Open a random recipe" onClick={onDice} disabled={recipes.length === 0}>
            <DiceIcon />
          </Button>
          <Button asChild variant="solid" intent="brand" size="sm">
            <Link to="/recipes/new">New recipe</Link>
          </Button>
        </div>
        <EmptyBoundary isEmpty={recipes.length === 0} fallback={<LibraryEmpty filtered={filtered} />}>
          {viewMode === "list" ? (
            <CardList recipes={recipes} mode="list" marking={marking} />
          ) : (
            <PhotoWall recipes={recipes} selected={open} marking={marking} priority={PRIORITY_WALL} />
          )}
        </EmptyBoundary>
      </div>
    </div>
  );
}
