import type { FoodCandidate, ReviewRow, UnitCandidate } from "../ingredient";
import type { FileRecipe } from "./sources/fileRecipe";
import { isTandoorRecipe } from "./sources/fileRecipe";
import { reviewRowsFromMealie } from "./sources/mealie/review";
import { reviewRowsFromTandoor } from "./sources/tandoor/review";

export { placeSteps } from "./placeSteps";
export { ingredientLines } from "./scraped/parts";
export { isTandoorRecipe as isTandoor } from "./sources/fileRecipe";
export { reviewRowsFromMealie as rowsFromMealie } from "./sources/mealie/review";
export { reviewRowsFromTandoor as rowsFromTandoor } from "./sources/tandoor/review";

/**
 * One recipe out of an export as review rows, whichever export it came from:
 * the rows in part order, and, from Tandoor alone, the step each row was
 * written under and the nested recipes rows stand for. Pure.
 */
export function rowsFromExport<U extends UnitCandidate, F extends FoodCandidate>(
  recipe: FileRecipe,
  vocabulary: { units: readonly U[]; foods: readonly F[] }
): { rows: ReviewRow<U, F>[]; rowSteps: number[] | null; subRecipeNames: string[] } {
  if (isTandoorRecipe(recipe)) return reviewRowsFromTandoor(recipe, vocabulary);
  return { ...reviewRowsFromMealie(recipe, vocabulary), rowSteps: null, subRecipeNames: [] };
}

/**
 * The row with every proposal taken: a food or unit the parser named but
 * nothing here matched becomes a create of that name. What a review left
 * untouched would decline, a whole-library import accepts, since nobody is
 * there to decide row by row. Pure.
 */
export function acceptProposals<U, F>(row: ReviewRow<U, F>): ReviewRow<U, F> {
  const food = row.food.kind === "none" && row.foodText !== "" ? { kind: "create" as const, name: row.foodText } : row.food;
  const unit = row.unit.kind === "none" && row.unitText !== "" && food.kind !== "none" ? { kind: "create" as const, name: row.unitText } : row.unit;
  return { ...row, food, unit };
}
