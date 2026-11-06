import { Button } from "@sixthshift/design-system/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@sixthshift/design-system/modal";
import { Muted } from "@sixthshift/design-system/muted";
import type { ShoppingItem } from "../../shopping";
import { ShoppingRow } from "../ShoppingRow";

/**
 * What is in the trolley, in a sheet from the bottom (decisions.md row 208),
 * opened from the bar at the foot of the list: a tap on a line (or its box)
 * takes it back out, and Clear the trolley asks first (`ClearTickedDialog`,
 * which the list opens once this has closed, so two dialogs never stack).
 * Clearing is refused offline, as it is everywhere: it deletes lines the
 * outbox cannot name one by one.
 */
export function TrolleySheet({
  items,
  onTick,
  onRemove,
  onClear,
  onClose,
  busy,
  offline,
}: {
  /** The ticked lines. */
  items: readonly ShoppingItem[];
  onTick: (id: string, ticked: boolean) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
  busy: boolean;
  offline: boolean;
}) {
  return (
    <Modal size="md" closable aria-label="In the trolley" className="max-sm:max-h-[85dvh]" onOpenChange={(open) => !open && onClose()}>
      <ModalHeader>In the trolley · {items.length}</ModalHeader>
      <ModalBody className="flex flex-col gap-2">
        <Muted as="p" className="text-sm">
          Tap a line to take it back out.
        </Muted>
        <ul className="flex flex-col divide-y divide-border-subtle" data-testid="shopping-trolley">
          {items.map((item) => (
            <ShoppingRow key={item.id} item={item} onTick={onTick} onRemove={onRemove} busy={busy} surface="bg-bg-normal" big />
          ))}
        </ul>
      </ModalBody>
      {/* Clear of the home indicator, as the filters sheet's footer is. */}
      <ModalFooter className="max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button type="button" variant="outline" intent="neutral" className="w-full" disabled={busy || offline} onClick={onClear}>
          Clear the trolley
        </Button>
      </ModalFooter>
    </Modal>
  );
}
