import { Sheet } from "@sixthshift/design-system/sheet";
import { AddToShoppingSheetContent, type AddToShoppingSheetContentProps } from "./AddToShoppingSheetContent";

export type AddToShoppingSheetProps = AddToShoppingSheetContentProps & { open: boolean };

export function AddToShoppingSheet({ open, ...props }: AddToShoppingSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && props.onCancel()} size="sm" closable aria-label="Add to shopping list">
      <AddToShoppingSheetContent {...props} />
    </Sheet>
  );
}
