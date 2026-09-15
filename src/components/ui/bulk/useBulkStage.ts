// Two stages: the pasted text, then (only when a `review` is supplied) the reviewed rows; `splitLines` decides what one item is.

import { type ReactNode, useState } from "react";
import { bulkLines } from "../../../domain/ingredient";

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

/**
 * The two-stage state behind a bulk paste: the text, the reviewed rows once
 * the first stage has run, and the busy/error state around a confirm that may
 * hit the server. Shared so the sheet and the inline entry panel run
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
   * entry uses `paragraphs` instead, so a blank line separates one
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
