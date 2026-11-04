// Server only: kept out of src/api/rpc/, whose files reach the client
// bundle with everything but their server functions' handlers.

import plan from "../../db/models/plan/repo";
import recipes from "../../db/models/recipe/repo";
import type { ParsedPlanEntryInput } from "../../domain/plan/plan";
import { rotateChoices } from "../../domain/recipes/recipe";

/**
 * New entries with a choice for every row whose recipe offers options and
 * that came without one (decisions.md row 198): the option the recipe's
 * earlier entries have used least, so the stir-fry is chicken one week and
 * beef the next. Entries in one write count each other, in order.
 */
export function withRotatedChoices(inputs: readonly ParsedPlanEntryInput[]): ParsedPlanEntryInput[] {
  const history = new Map<string, Record<string, string>[]>();
  return inputs.map((input) => {
    if (input.recipeId === null || Object.keys(input.choices).length > 0) return input;
    const doc = recipes.getById(input.recipeId);
    if (doc === null) return input;
    const past = history.get(input.recipeId) ?? plan.choicesOf(input.recipeId);
    const choices = rotateChoices(doc, past);
    history.set(input.recipeId, [...past, choices]);
    return { ...input, choices };
  });
}
