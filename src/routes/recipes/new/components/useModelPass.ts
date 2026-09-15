// Runs beside the review with its own busy state, so Create stays available while the model reads.

import { useState } from "react";
import type { ImportedRecipe } from "../../../../domain/import";
import type { FoodRow } from "../../../../domain/reference";
import { type ModelReader, modelPass, shouldReadWithModel } from "./importSummary";

export type ModelPassOptions = {
  aiAvailable: boolean;
  reader: ModelReader;
  /** The answer, with the vocabulary the first pass used, to re-render the review from. */
  onAnswer: (result: ImportedRecipe, foods: readonly FoodRow[]) => void;
};

export function useModelPass({ aiAvailable, reader, onAnswer }: ModelPassOptions) {
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  /**
   * Hand a page's rules result to the model and re-render the review from what
   * comes back. The vocabulary is passed in rather than fetched again: the
   * answer's lines are the same lines in a different order, so they are
   * reviewed against the same foods the first pass used.
   */
  const readWithModel = (found: ImportedRecipe, foods: readonly FoodRow[]) => {
    if (!shouldReadWithModel(found, aiAvailable)) return;
    setReading(true);
    setReadError(null);
    void modelPass(found, reader).then((outcome) => {
      setReading(false);
      if (!outcome.ok) {
        setReadError(outcome.error);
        return;
      }
      onAnswer(outcome.result, foods);
    });
  };

  /** Forget a failed read; a fresh fetch starts clean. */
  const clearError = () => setReadError(null);

  /** Leaving the review drops the pass with it. */
  const reset = () => {
    setReading(false);
    setReadError(null);
  };

  return { reading, readError, readWithModel, clearError, reset };
}
