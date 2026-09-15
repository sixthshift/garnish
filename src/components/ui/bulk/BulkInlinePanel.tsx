import { Button } from "@sixthshift/design-system/button";
import { Textarea } from "@sixthshift/design-system/textarea";
import { bulkLines } from "../../../domain/ingredient";
import { BulkReviewList } from "./BulkReviewList";
import type { BulkReview } from "./useBulkStage";

export type BulkInlinePanelProps<R> = {
  /** Noun for labels and copy: "ingredient" or "step". */
  itemName: string;
  /** Absent for the plain (no-review) case: the steps side, where "Add" commits the split lines straight away. */
  review?: BulkReview<R>;
  text: string;
  /** Null before "Add": the panel is still on the textarea. */
  rows: R[] | null;
  busy?: boolean;
  error?: string | null;
  disabled?: boolean;
  /** The textarea's placeholder. Default: "One {itemName} per line". */
  placeholder?: string;
  /** How `text` becomes the lines "Add" has to commit, for the disabled check. Default: `bulkLines` (one per line). */
  splitLines?: (text: string) => string[];
  onTextChange: (text: string) => void;
  onRowsChange: (rows: R[]) => void;
  /** The primary action: "Add" on the textarea, "Confirm" on the review. */
  onAdvance: () => void;
  onBack: () => void;
};

/**
 * The same two stages the sheet runs, rendered in place rather than in a
 * sheet: a plain textarea with "Add", which swaps itself for the caller's
 * review rows and "Confirm". Text first, because typing a recipe out is how a
 * recipe arrives; the structured row is the correction view. No state of its own — `BulkInlineAdd` holds it — so a test can render
 * either stage directly, the same split `BulkAddFields` uses.
 *
 * With no `review` (the steps side) `rows` never leaves null, so only
 * the textarea stage ever renders — the plain variant `BulkAddSheet` already
 * supports without a sheet around it.
 */
export function BulkInlinePanel<R>({
  itemName,
  review,
  text,
  rows,
  busy,
  error,
  disabled,
  placeholder,
  splitLines = bulkLines,
  onTextChange,
  onRowsChange,
  onAdvance,
  onBack,
}: BulkInlinePanelProps<R>) {
  const off = disabled === true || busy === true;
  return (
    <div className="flex flex-col gap-3" data-bulk-inline="">
      {review === undefined || rows === null ? (
        <>
          <Textarea
            aria-label={`New ${itemName}s`}
            rows={6}
            placeholder={placeholder ?? `One ${itemName} per line`}
            value={text}
            disabled={off}
            onChange={(event) => onTextChange(event.target.value)}
          />
          <div className="flex justify-end">
            <Button type="button" variant="solid" intent="brand" size="sm" disabled={off || splitLines(text).length === 0} onClick={onAdvance}>
              Add
            </Button>
          </div>
        </>
      ) : (
        <>
          <BulkReviewList itemName={itemName} rows={rows} review={review} commitLabel="Confirm" onRowsChange={onRowsChange} />
          {error !== null && error !== undefined && (
            <p className="text-sm text-fg-danger" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={off} onClick={onBack}>
              Back
            </Button>
            <Button type="button" variant="solid" intent="brand" size="sm" disabled={off || rows.length === 0} onClick={onAdvance}>
              Confirm
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
