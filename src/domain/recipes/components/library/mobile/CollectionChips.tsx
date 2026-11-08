import { Toggle } from "@sixthshift/design-system/toggle";
import { ToggleGroup } from "@sixthshift/design-system/toggle-group";
import { HeartIcon } from "../../../../../components/ui/icons";
import { type Shelf, shelfFromValue, shelfOptions } from "../shelf";

const CHIP = "[&_button]:rounded-full [&_button]:px-3.5 [&_button]:whitespace-nowrap";

/**
 * A phone's collections as one row of chips that scrolls sideways (decisions.md
 * row 208): the shelves, one at a time, and Favourites beside them, which
 * narrows whichever shelf is chosen. Both are the address's, as the filter
 * sheet's are; the sheet's "Favourites only" is the same switch.
 */
export function CollectionChips({
  shelf,
  onShelfChange,
  favourite,
  onFavouriteChange,
}: {
  shelf: Shelf | undefined;
  onShelfChange: (shelf: Shelf | undefined) => void;
  favourite: boolean;
  onFavouriteChange: (favourite: boolean) => void;
}) {
  return (
    // Bleeds to the screen's edges so a chip scrolls off the side rather than being cut at the page's padding.
    <div className={`-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] ${CHIP}`} data-testid="collection-chips">
      <ToggleGroup
        type="single"
        appearance="separate"
        variant="outline"
        intent="neutral"
        size="sm"
        aria-label="Collection"
        className="flex-nowrap"
        options={shelfOptions}
        value={shelf ?? "all"}
        // Pressing the chosen chip again leaves it chosen: one is always set, Everything when none is.
        onValueChange={(value) => value !== "" && onShelfChange(shelfFromValue(value))}
      />
      <Toggle variant="outline" intent="neutral" size="sm" pressed={favourite} onPressedChange={onFavouriteChange} className="shrink-0 gap-1.5">
        <HeartIcon filled={favourite} />
        Favourites
      </Toggle>
    </div>
  );
}
