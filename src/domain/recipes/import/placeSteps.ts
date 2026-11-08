import { type FoodCandidate, parseIngredient, type UnitCandidate } from "../ingredient";
import { ingredientsInStep } from "../recipe";
import type { ScrapedPart, ScrapedRecipe } from "./scraped/types";

// A recipe card that grouped its ingredients but not its steps (decisions.md
// row 204): every step sits in the main body, so the steps go to the parts
// whose ingredients they name (row 205) and read beside what they use; a step
// may still link a row of any part (row 228). The names are the library's, so the lines are read against it
// first: "Brown the chicken" names the chicken a line called "chicken thighs".

/** A part's name as a step would say it: "To marinate the chicken:" is "marinate the chicken". Pure. */
function spoken(name: string): string {
  return name
    .replace(/\([^)]*\)/g, " ")
    .replace(/[:.]+\s*$/, "")
    .replace(/^\s*(to|for)\s+/i, "")
    .replace(/^\s*(the|your)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Whether `phrase` is in `text` on word boundaries, case ignored. Pure. */
function says(text: string, phrase: string): boolean {
  if (phrase.length < 3) return false;
  const at = text.toLowerCase().indexOf(phrase);
  if (at < 0) return false;
  const before = text[at - 1];
  const after = text[at + phrase.length];
  return (before === undefined || !/[\p{L}\p{N}]/u.test(before)) && (after === undefined || !/[\p{L}\p{N}]/u.test(after));
}

/**
 * The recipe with each main-body step moved to the part whose ingredients it
 * names most, and whether every step found a home. A step that names one
 * part itself ("Combine the ingredients for the Cajun seasoning") goes there
 * whatever foods it names. A step naming no
 * ingredient follows the step before it (a "bake for 20 minutes" goes where
 * the bake went); one before any placed step stays in the main body, where
 * the method opens. A step naming two parts' ingredients equally stays put,
 * and the read is then not settled. Only a recipe whose steps are all in the
 * main body is placed; anything else is returned as it was, unsettled. Pure.
 */
export function placeSteps<U extends UnitCandidate, F extends FoodCandidate>(
  recipe: ScrapedRecipe,
  vocabulary: { units: readonly U[]; foods: readonly F[] }
): { recipe: ScrapedRecipe; settled: boolean } {
  const main = recipe.parts.find((part) => part.name === "");
  const named = recipe.parts.filter((part) => part.name !== "");
  const unchanged = { recipe, settled: false };
  if (main === undefined || main.steps.length === 0 || named.length === 0 || named.some((part) => part.steps.length > 0)) return unchanged;

  // Each part's lines as rows with the library's foods, for the matcher.
  const rows = recipe.parts.map((part) => part.ingredients.map((line) => ({ food: parseIngredient(line, vocabulary).food })));
  const placed: string[][] = recipe.parts.map(() => []);
  const mainIndex = recipe.parts.indexOf(main);
  let previous = mainIndex;
  let settled = true;
  let moved = 0;

  const names = recipe.parts.map((part) => (part.name === "" ? "" : spoken(part.name)));
  for (const step of main.steps) {
    const naming = names.flatMap((name, index) => (name !== "" && says(step, name) ? [index] : []));
    if (naming.length === 1) {
      const home = naming[0]!;
      placed[home]!.push(step);
      if (home !== mainIndex) moved += 1;
      previous = home;
      continue;
    }
    const counts = rows.map((partRows) => ingredientsInStep(step, partRows).length);
    const best = Math.max(...counts);
    const leaders = counts.flatMap((count, index) => (count === best ? [index] : []));
    let home = previous;
    if (best > 0 && leaders.length === 1) home = leaders[0]!;
    else if (best > 0) settled = false;
    placed[home]!.push(step);
    if (home !== mainIndex) moved += 1;
    previous = home;
  }

  if (moved === 0) return unchanged;
  const parts: ScrapedPart[] = recipe.parts
    .map((part, index) => ({ ...part, steps: placed[index]! }))
    .filter((part) => part.name !== "" || part.ingredients.length > 0 || part.steps.length > 0);
  return { recipe: { ...recipe, parts }, settled };
}
