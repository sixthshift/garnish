import { BulkInlinePanel } from "./BulkInlinePanel";
import { type BulkReview, useBulkStage } from "./useBulkStage";

export type BulkInlineAddProps<R> = {
  /** Noun for labels and copy: "ingredient" or "step". */
  itemName: string;
  disabled?: boolean;
  /** The textarea's placeholder. Default: "One {itemName} per line". */
  placeholder?: string;
  /** How pasted text becomes lines. Default: `bulkLines` (one per line). */
  splitLines?: (text: string) => string[];
} & (
  | {
      /** Called once, with one string per split line, when "Add" is pressed. No review stage: the steps side. */
      onAdd: (lines: string[]) => void;
      review?: undefined;
    }
  | { onAdd?: undefined; review: BulkReview<R> }
);

/** `BulkInlinePanel` with the shared stage state around it. What an empty list renders instead of "nothing yet". */
export function BulkInlineAdd<R>({ itemName, review, onAdd, disabled, placeholder, splitLines }: BulkInlineAddProps<R>) {
  const stage = useBulkStage<R>({ itemName, review, onAdd, splitLines });
  return (
    <BulkInlinePanel
      itemName={itemName}
      review={review}
      text={stage.text}
      rows={stage.rows}
      busy={stage.busy}
      error={stage.error}
      disabled={disabled}
      placeholder={placeholder}
      splitLines={splitLines}
      onTextChange={stage.setText}
      onRowsChange={stage.setRows}
      onAdvance={() => void stage.advance()}
      onBack={stage.back}
    />
  );
}
