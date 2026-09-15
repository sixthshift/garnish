import type { BulkReview } from "./useBulkStage";

export type BulkReviewListProps<R> = {
  /** Noun for labels and copy: "ingredient" or "step". */
  itemName: string;
  rows: readonly R[];
  review: BulkReview<R>;
  /** The commit button's label, named in the copy: "Add" in the sheet, "Confirm" inline. */
  commitLabel?: string;
  onRowsChange: (rows: R[]) => void;
};

/**
 * The review stage's list: one block per pasted line, rendered by the
 * caller's `renderRow`, with `onChange` writing that row back in place. No
 * state of its own, so a test can render it directly.
 */
export function BulkReviewList<R>({ itemName, rows, review, commitLabel = "Add", onRowsChange }: BulkReviewListProps<R>) {
  return (
    <div className="flex flex-col gap-3" data-bulk-review="">
      <p className="text-sm text-fg-subtle">{`${rows.length} ${itemName}${rows.length === 1 ? "" : "s"} to review. Nothing is created until you press ${commitLabel}.`}</p>
      <ul className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <li key={review.keyOf(row, index)} className="rounded-lg border border-border-normal p-3">
            {review.renderRow(row, index, (next) => onRowsChange(rows.map((current, i) => (i === index ? next : current))))}
          </li>
        ))}
      </ul>
    </div>
  );
}
