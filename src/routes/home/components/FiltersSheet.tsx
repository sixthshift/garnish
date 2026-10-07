import { Button } from "@sixthshift/design-system/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@sixthshift/design-system/modal";
import { FilterBar, type FilterBarProps } from "./FilterBar";

export type FiltersSheetProps = FilterBarProps & {
  /** Recipes the filters leave, for the closing button. */
  count: number;
  onClose: () => void;
};

/**
 * The filter bar in a sheet, for a phone. `Modal` rather than `Sheet`: below
 * `sm` it rises from the bottom at its content's height, leaving the results in
 * view above it, where `Sheet` takes the whole screen. Every change applies at
 * once, through the URL as inline, so "Show N recipes" only closes it.
 */
export function FiltersSheet({ count, onClose, ...filters }: FiltersSheetProps) {
  return (
    <Modal size="md" closable aria-label="Filters" onOpenChange={(open) => !open && onClose()}>
      <ModalHeader>Filters</ModalHeader>
      <ModalBody>
        <FilterBar {...filters} />
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="solid" intent="brand" className="w-full" onClick={onClose}>
          {count === 1 ? "Show 1 recipe" : `Show ${count} recipes`}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
