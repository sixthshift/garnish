import type { FoodCandidate, ReviewRow, UnitCandidate } from "../../../ingredient";
import { reviewRowFromMealie } from "../mealie/review";
import type { TandoorRecipe } from "./types";

/** Where a row sits: which of its part's steps it was written under, and what it stands for. */
export type TandoorReview<U, F> = {
  rows: ReviewRow<U, F>[];
  /** The step within the row's part that owns it, or -1 when no step does. */
  rowSteps: number[];
  /** The names of the nested recipes these rows stand for, for the sub-recipe link. */
  subRecipeNames: string[];
};

/**
 * Every row of a Tandoor recipe as a review row, in part order — the same order
 * the parts' own lines are in, so the draft puts each row back on the part it
 * came from — with the step each row belongs to beside it, so the draft links
 * it where Tandoor had it rather than where `suggestLinks` guesses. Pure.
 */
export function reviewRowsFromTandoor<U extends UnitCandidate, F extends FoodCandidate>(
  recipe: TandoorRecipe,
  vocabulary: { units: readonly U[]; foods: readonly F[] }
): TandoorReview<U, F> {
  const rows: ReviewRow<U, F>[] = [];
  const rowSteps: number[] = [];
  const subRecipeNames: string[] = [];

  for (const part of recipe.parts) {
    const stepOf = new Map<number, number>();
    part.stepRows.forEach((indices, stepIndex) => {
      for (const index of indices) stepOf.set(index, stepIndex);
    });
    part.rows.forEach((row, index) => {
      rows.push(reviewRowFromMealie(row, String(rows.length), vocabulary));
      rowSteps.push(stepOf.get(index) ?? -1);
      if (row.recipeName !== "" && !subRecipeNames.some((name) => name.toLowerCase() === row.recipeName.toLowerCase())) {
        subRecipeNames.push(row.recipeName);
      }
    });
  }

  return { rows, rowSteps, subRecipeNames };
}
