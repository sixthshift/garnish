import { Button } from "@sixthshift/design-system/button";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Heading } from "@sixthshift/design-system/heading";
import { Toggle } from "@sixthshift/design-system/toggle";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { RecipeSummary, SortDir, SortKey } from "../../../recipe";
import { MarkChooser } from "../../facets/MarkUnder";
import { type Marking, START_MARKING } from "../../facets/marking";
import { ActiveFilters } from "../ActiveFilters";
import { LibraryEmpty } from "../CardList";
import type { FilterBarProps } from "../FilterBar";
import type { Shelf } from "../ShelfToggle";
import { CollectionChips } from "./CollectionChips";
import { FiltersSheet } from "./FiltersSheet";
import { PhotoGrid } from "./PhotoGrid";
import { SearchPill } from "./SearchPill";

export type PhoneLibraryProps = {
  recipes: readonly RecipeSummary[];
  /** Every recipe in the library, for the search's placeholder. */
  total: number;
  /** A search or a filter is set: an empty grid offers to clear it. */
  filtered: boolean;
  filters: FilterBarProps;
  filterCount: number;
  onClearFilters: () => void;
  shelf: Shelf | undefined;
  onShelfChange: (shelf: Shelf | undefined) => void;
  query: string;
  onQueryChange: (query: string) => void;
  onQuerySubmit: () => void;
  sort: SortKey;
  dir: SortDir;
  onSortChange: (sort: SortKey, dir: SortDir) => void;
  onDice: () => void;
  /** What each card offers under it while marking: how it is cooked, or one value of one layer. */
  marking: Marking | null;
  onMarkingChange: (marking: Marking | null) => void;
};

/**
 * A phone's library (decisions.md row 208): the title and New, the
 * collections as chips, what the sheet has set as chips to take off, two
 * columns of photos, and the search held at the foot of the screen with the
 * filters beside it in a sheet. Everything it sets is the address's, as a
 * desktop's three panes set it.
 */
export function PhoneLibrary(props: PhoneLibraryProps) {
  const { recipes, filters, filterCount } = props;
  const [sheetOpen, setSheetOpen] = useState(false);
  const { marking, onMarkingChange } = props;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-4" data-testid="phone-library">
      <div className="flex items-center gap-2" data-page-header="">
        <Heading as="h1" className="flex-1">
          Recipes
        </Heading>
        {/* "Mark" is the start of its name, so a voice says what it reads (decisions.md row 195). */}
        <Toggle
          variant="outline"
          intent="neutral"
          size="sm"
          pressed={marking !== null}
          onPressedChange={(on) => onMarkingChange(on ? START_MARKING : null)}
          aria-label={marking ? "Done marking" : "Mark recipes"}
        >
          {marking ? "Done" : "Mark"}
        </Toggle>
        <Button asChild variant="solid" intent="brand" size="sm">
          <Link to="/recipes/new" aria-label="New recipe">
            <span aria-hidden="true">+</span> New
          </Link>
        </Button>
      </div>
      {marking && <MarkChooser marking={marking} onChange={onMarkingChange} className="w-full" />}
      <CollectionChips shelf={props.shelf} onShelfChange={props.onShelfChange} favourite={filters.favourite} onFavouriteChange={filters.onFavouriteChange} />
      {/* Favourites has its chip above, so only what the sheet set is repeated here. */}
      <ActiveFilters {...filters} favourite={false} onClearAll={props.onClearFilters} />
      <EmptyBoundary isEmpty={recipes.length === 0} fallback={<LibraryEmpty filtered={props.filtered} />}>
        <PhotoGrid recipes={recipes} marking={marking} />
      </EmptyBoundary>
      <SearchPill
        query={props.query}
        onQueryChange={props.onQueryChange}
        onSubmit={props.onQuerySubmit}
        total={props.total}
        filterCount={filterCount}
        onOpenFilters={() => setSheetOpen(true)}
      />
      {sheetOpen && (
        <FiltersSheet
          {...filters}
          count={recipes.length}
          sort={props.sort}
          dir={props.dir}
          onSortChange={props.onSortChange}
          onRandom={recipes.length > 0 ? props.onDice : undefined}
          onClear={filterCount > 0 || props.shelf !== undefined ? props.onClearFilters : undefined}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}
