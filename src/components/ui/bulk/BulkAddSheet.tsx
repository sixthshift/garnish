import { Button } from "@sixthshift/design-system/button";
import { Sheet } from "@sixthshift/design-system/sheet";
import { BulkAddFields } from "./BulkAddFields";
import { BulkReviewList } from "./BulkReviewList";
import { type BulkReview, useBulkStage } from "./useBulkStage";

export type BulkAddSheetProps<R> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Noun for labels and copy: "ingredient" or "step". */
  itemName: string;
  disabled?: boolean;
} & (
  | {
      /** Called once, with one string per non-blank line, when "Add" is pressed. Not called when the sheet is cancelled or the text is blank. */
      onAdd: (lines: string[]) => void;
      review?: undefined;
    }
  | { onAdd?: undefined; review: BulkReview<R> }
);

export function BulkAddSheet<R>({ open, onOpenChange, itemName, onAdd, review, disabled }: BulkAddSheetProps<R>) {
  const stage = useBulkStage<R>({ itemName, review, onAdd, onDone: () => onOpenChange(false) });
  const { text, setText, rows, setRows, busy, error, reviewing } = stage;

  const close = () => {
    stage.reset();
    onOpenChange(false);
  };

  const back = stage.back;
  const add = stage.advance;

  const primaryLabel = review !== undefined && rows === null ? "Review" : "Add";
  const primaryDisabled = disabled === true || busy || !stage.canAdvance;

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())} size="md" closable aria-label={`Bulk add ${itemName}s`}>
      <Sheet.Header>
        <h2 className="text-base font-medium">{`Bulk add ${itemName}s`}</h2>
      </Sheet.Header>
      <Sheet.Body>
        {review !== undefined && rows !== null ? (
          <BulkReviewList itemName={itemName} rows={rows} review={review} onRowsChange={setRows} />
        ) : (
          <BulkAddFields itemName={itemName} text={text} disabled={disabled} onTextChange={setText} />
        )}
        {error !== null && (
          <p className="mt-3 text-sm text-fg-danger" role="alert">
            {error}
          </p>
        )}
      </Sheet.Body>
      <Sheet.Footer>
        <Button type="button" variant="ghost" intent="neutral" disabled={disabled || busy} onClick={reviewing ? back : close}>
          {reviewing ? "Back" : "Cancel"}
        </Button>
        <Button type="button" variant="solid" intent="brand" disabled={primaryDisabled} onClick={() => void add()}>
          {primaryLabel}
        </Button>
      </Sheet.Footer>
    </Sheet>
  );
}
