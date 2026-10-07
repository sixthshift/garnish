import { Modal } from "@sixthshift/design-system/modal";
import { AddToShoppingSheetContent, type AddToShoppingSheetContentProps } from "./AddToShoppingSheetContent";

export type AddToShoppingSheetProps = AddToShoppingSheetContentProps & { open: boolean };

/**
 * `Modal` rather than `Sheet`, as the filters and the plan's add sheet are
 * (decisions.md rows 44 and 45): below `sm` it rises from the bottom at its
 * content's height, so a handful of ingredients is a short sheet with Add
 * under them rather than a full screen with Add at its foot; a long list
 * stops at the Modal's own 95% and scrolls in the body. It names itself from
 * its header, which says which recipe and how many it adds for.
 */
export function AddToShoppingSheet({ open, ...props }: AddToShoppingSheetProps) {
  if (!open) return null;
  return (
    <Modal size="md" closable onOpenChange={(next) => !next && props.onCancel()}>
      <AddToShoppingSheetContent {...props} />
    </Modal>
  );
}
