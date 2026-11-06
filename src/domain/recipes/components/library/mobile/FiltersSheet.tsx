import { Button } from "@sixthshift/design-system/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@sixthshift/design-system/modal";
import { ToggleGroup } from "@sixthshift/design-system/toggle-group";
import { DiceIcon } from "../../../../../components/ui/icons";
import { SORT_OPTIONS, type SortDir, type SortKey } from "../../../recipe";
import { FilterBar, type FilterBarProps } from "../FilterBar";

export type FiltersSheetProps = FilterBarProps & {
  /** Recipes the filters leave, for the closing button. */
  count: number;
  sort: SortKey;
  dir: SortDir;
  onSortChange: (sort: SortKey, dir: SortDir) => void;
  /** Open a random recipe from those the filters leave; absent when they leave none. */
  onRandom?: () => void;
  /** Clear every filter, the collection with them. Offered while any is set. */
  onClear?: () => void;
  onClose: () => void;
};

const sortValue = (sort: SortKey, dir: SortDir) => `${sort}-${dir}`;

/**
 * A phone's filters in a sheet from the bottom (decisions.md row 208), opened
 * from the round button beside the search: the tags with their counts and
 * Match all, the food, favourites, the order and a random recipe. `Modal`
 * rather than `Sheet`: below `sm` it rises from the bottom at its content's
 * height, leaving the results in view above it, where `Sheet` takes the whole
 * screen. Every change applies at once, through the address, so "Show N
 * recipes" only closes it.
 */
export function FiltersSheet({ count, sort, dir, onSortChange, onRandom, onClear, onClose, ...filters }: FiltersSheetProps) {
  return (
    <Modal size="md" closable aria-label="Filters" onOpenChange={(open) => !open && onClose()}>
      <ModalHeader>Filters</ModalHeader>
      <ModalBody className="flex flex-col gap-5">
        <FilterBar {...filters} />
        <section className="flex flex-col gap-2" aria-labelledby="filters-order">
          <h3 id="filters-order" className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            Order
          </h3>
          <ToggleGroup
            type="single"
            appearance="separate"
            variant="outline"
            intent="neutral"
            size="sm"
            aria-label="Order"
            className="flex-wrap"
            options={SORT_OPTIONS.map((option) => ({ value: sortValue(option.key, option.dir), label: option.label }))}
            value={sortValue(sort, dir)}
            onValueChange={(value) => {
              const option = SORT_OPTIONS.find((each) => sortValue(each.key, each.dir) === value);
              if (option) onSortChange(option.key, option.dir);
            }}
          />
        </section>
        {(onRandom || onClear) && (
          <div className="flex flex-wrap items-center gap-2">
            {onRandom && (
              <Button type="button" variant="outline" intent="neutral" size="sm" className="gap-2" onClick={onRandom}>
                <DiceIcon />
                Open a random recipe
              </Button>
            )}
            {onClear && (
              <Button type="button" variant="ghost" intent="neutral" size="sm" onClick={onClear}>
                Clear filters
              </Button>
            )}
          </div>
        )}
      </ModalBody>
      {/* Clear of the home indicator, as the tab bar and cook footer are. */}
      <ModalFooter className="max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Button type="button" variant="solid" intent="brand" className="w-full" onClick={onClose}>
          {count === 1 ? "Show 1 recipe" : `Show ${count} recipes`}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
