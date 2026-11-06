import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";

/**
 * Clearing deletes every ticked line at once and nothing brings them back, so
 * it asks first; the button that opens the question is neutral and the
 * dialog's is the red one (rule 5). The phone's list and the desktop's store
 * walk both ask it.
 */
export function ClearTickedDialog({ count, onCancel, onConfirm }: { count: number; onCancel: () => void; onConfirm: () => void }) {
  return (
    <ConfirmDialog
      title={`Clear ${count} ticked ${count === 1 ? "item" : "items"}?`}
      aria-label="Clear ticked items"
      confirmLabel="Clear"
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      They come off the list for good.
    </ConfirmDialog>
  );
}
