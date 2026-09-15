// A `sheet` for pasting a batch of items, one per line, used by the
// ingredients and steps editors (M13.4). Three buttons clean up a rough paste
// before "Add" commits it: trim each line, strip a leading list number
// ("1.", "2)"), or turn blank-line-separated paragraphs into one line each.
// "Add" splits the cleaned text on newlines, drops blank lines, and hands the
// caller one string per remaining line — the steps editor turns each into a
// step of its own. The ingredients editor reviews them first; see `review`
// below.
//
// `BulkAddFields` (the textarea and the three buttons) is a plain function of
// `text` and `onTextChange`, no state of its own, so a test can call it
// directly and drive its buttons without a DOM — the same shape as
// `IngredientFields`. `BulkAddSheet` only adds the sheet chrome and the
// open/text state around it.
//
// A caller that cannot commit a paste unreviewed passes `review` instead of
// `onAdd` (M17.5, the ingredients side). The sheet then gains a second stage:
// "Review" turns the cleaned lines into rows the caller supplies and renders
// them with the caller's `renderRow`, and the footer's Add commits those rows
// through `confirm`. The sheet knows nothing about ingredients — it holds the
// row list, "Back" to the textarea, and the busy/error state around a confirm
// that may hit the server. With no `review` (the steps side) nothing changes:
// Add still hands the caller one string per line.
//
// Both stages are also available without the sheet: `useBulkStage` holds the
// state and `BulkInlinePanel`/`BulkInlineAdd` render the same textarea and the
// same review rows in place, which is what an empty ingredient list shows
// instead of "nothing yet" (M27.2, decisions.md row 63). The plain (no
// `review`) case works the same way inline as it does in the sheet — "Add"
// hands the caller its split lines straight away — which is what an empty
// step list shows (M27.3): `splitLines` defaults to `bulkLines` but the steps
// side passes `paragraphs`, so a blank line separates one step from the next
// the way a pasted method reads, not a newline.
import { Button } from "@sixthshift/design-system/button";
import { Sheet } from "@sixthshift/design-system/sheet";
import { Textarea } from "@sixthshift/design-system/textarea";
import { type ReactNode, useState } from "react";
import { bulkLines, splitOnBlankLines, stripLeadingNumbers, trimLines } from "../../domain/ingredient";

export type BulkAddFieldsProps = {
  /** Noun for labels and copy: "ingredient" or "step". */
  itemName: string;
  text: string;
  disabled?: boolean;
  onTextChange: (text: string) => void;
};

export function BulkAddFields({ itemName, text, disabled, onTextChange }: BulkAddFieldsProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-fg-subtle">{`One ${itemName} per line.`}</p>
      <Textarea
        aria-label={`Bulk ${itemName} text`}
        rows={10}
        placeholder={`Paste ${itemName}s, one per line`}
        value={text}
        disabled={disabled}
        onChange={(event) => onTextChange(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" intent="neutral" size="sm" disabled={disabled} onClick={() => onTextChange(trimLines(text))}>
          Trim whitespace
        </Button>
        <Button type="button" variant="outline" intent="neutral" size="sm" disabled={disabled} onClick={() => onTextChange(stripLeadingNumbers(text))}>
          Strip leading numbers
        </Button>
        <Button type="button" variant="outline" intent="neutral" size="sm" disabled={disabled} onClick={() => onTextChange(splitOnBlankLines(text))}>
          Split on blank lines
        </Button>
      </div>
    </div>
  );
}

/** The review stage a caller supplies to stop a paste committing unreviewed. `R` is whatever row type that caller reviews. */
export type BulkReview<R> = {
  /** The cleaned lines as rows to review. Pure in the caller: parsing only, nothing created. */
  rows: (lines: string[]) => R[];
  /** A stable React key for one row. */
  keyOf: (row: R, index: number) => string;
  /** One row's review controls. `onChange` replaces that row in the list. */
  renderRow: (row: R, index: number, onChange: (next: R) => void) => ReactNode;
  /** Commit the reviewed rows, creating only what the reviewer approved. */
  confirm: (rows: R[]) => void | Promise<void>;
};

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

/**
 * The two-stage state behind a bulk paste: the text, the reviewed rows once
 * the first stage has run, and the busy/error state around a confirm that may
 * hit the server. Shared so the sheet and the inline entry panel (M27.2) run
 * literally the same stage logic; only the chrome and the button labels
 * differ. `onDone` fires after a successful commit — the sheet closes, the
 * inline panel has nothing left to do because its list is no longer empty.
 */
export type BulkStageOptions<R> = {
  /** Noun for labels and copy: "ingredient" or "step". */
  itemName: string;
  review?: BulkReview<R>;
  onAdd?: (lines: string[]) => void;
  onDone?: () => void;
  /**
   * How the raw text becomes the lines handed to `onAdd`/`review.rows`.
   * Default: one per newline-separated line (`bulkLines`). The steps' inline
   * entry (M27.3) uses `paragraphs` instead, so a blank line separates one
   * step from the next rather than a newline, matching how a method reads.
   */
  splitLines?: (text: string) => string[];
};

export function useBulkStage<R>({ itemName, review, onAdd, onDone, splitLines = bulkLines }: BulkStageOptions<R>) {
  const [text, setText] = useState("");
  // Null until the first stage has been committed: still on the textarea.
  const [rows, setRows] = useState<R[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setText("");
    setRows(null);
    setBusy(false);
    setError(null);
  };

  const back = () => {
    setRows(null);
    setError(null);
  };

  /** The primary action: parse the lines into rows, or commit the rows already reviewed. */
  const advance = async () => {
    const lines = splitLines(text);
    if (review === undefined) {
      if (lines.length > 0) onAdd?.(lines);
      reset();
      onDone?.();
      return;
    }
    if (rows === null) {
      if (lines.length > 0) setRows(review.rows(lines));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await review.confirm(rows);
      reset();
      onDone?.();
    } catch (cause) {
      setBusy(false);
      setError(cause instanceof Error ? cause.message : `Could not add the ${itemName}s`);
    }
  };

  const reviewing = review !== undefined && rows !== null;
  return {
    text,
    setText,
    rows,
    setRows,
    busy,
    error,
    reviewing,
    /** True when the primary action has something to do: lines to parse, or rows to commit. */
    canAdvance: reviewing ? rows.length > 0 : splitLines(text).length > 0,
    reset,
    back,
    advance,
  };
}

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
    <Sheet
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      size="md"
      closable
      aria-label={`Bulk add ${itemName}s`}
    >
      <Sheet.Header>
        <h2 className="text-base font-medium">{`Bulk add ${itemName}s`}</h2>
      </Sheet.Header>
      <Sheet.Body>
        {review !== undefined && rows !== null ? (
          <BulkReviewList
            itemName={itemName}
            rows={rows}
            review={review}
            onRowsChange={setRows}
          />
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

// --- Inline entry (M27.2) -----------------------------------------------------

export type BulkInlinePanelProps<R> = {
  /** Noun for labels and copy: "ingredient" or "step". */
  itemName: string;
  /** Absent for the plain (no-review) case: the steps side (M27.3), where "Add" commits the split lines straight away. */
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
 * recipe arrives; the structured row is the correction view (decisions.md row
 * 63). No state of its own — `BulkInlineAdd` holds it — so a test can render
 * either stage directly, the same split `BulkAddFields` uses.
 *
 * With no `review` (the steps side, M27.3) `rows` never leaves null, so only
 * the textarea stage ever renders — the plain variant `BulkAddSheet` already
 * supports without a sheet around it.
 */
export function BulkInlinePanel<R>({ itemName, review, text, rows, busy, error, disabled, placeholder, splitLines = bulkLines, onTextChange, onRowsChange, onAdvance, onBack }: BulkInlinePanelProps<R>) {
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
      /** Called once, with one string per split line, when "Add" is pressed. No review stage: the steps side (M27.3). */
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
