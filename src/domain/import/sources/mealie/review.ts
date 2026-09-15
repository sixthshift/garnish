import { type FoodCandidate, parseIngredient, type ReviewRow, reviewRow, type UnitCandidate } from "../../../ingredient";
import type { MealieIngredient, MealieRecipe } from "./types";

/** A review row from a row Mealie already structured, matched against the vocabulary by name. Pure. */
export function reviewRowFromMealie<U extends UnitCandidate, F extends FoodCandidate>(
  row: MealieIngredient,
  key: string,
  vocabulary: { units: readonly U[]; foods: readonly F[] }
): ReviewRow<U, F> {
  // Nothing structured to carry across: the line is all Mealie had, so it is
  // parsed like any other pasted line.
  if (row.food === "") return reviewRow(parseIngredient(row.originalText, vocabulary), key);

  const food = matchFood(row.food, vocabulary.foods);
  const unit = row.unit === "" ? null : matchUnit(row.unit, vocabulary.units);
  return {
    key,
    originalText: row.originalText,
    quantity: row.quantity,
    fixed: false,
    note: row.note,
    unitText: unit === null ? row.unit : "",
    foodText: food === null ? row.food : "",
    unit: unit === null ? { kind: "none" } : { kind: "existing", row: unit },
    food: food === null ? { kind: "none" } : { kind: "existing", row: food },
  };
}

const same = (a: string | null | undefined, b: string): boolean => (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

/** The food of that name, by name, plural or alias. Pure. */
export function matchFood<F extends FoodCandidate>(name: string, foods: readonly F[]): F | null {
  return foods.find((food) => same(food.name, name) || same(food.pluralName, name) || food.aliases.some((alias) => same(alias, name))) ?? null;
}

/** The unit of that name, by name, plural or abbreviation. Pure. */
export function matchUnit<U extends UnitCandidate>(name: string, units: readonly U[]): U | null {
  return units.find((unit) => same(unit.name, name) || same(unit.pluralName, name) || same(unit.abbreviation, name)) ?? null;
}

/**
 * Every row of a Mealie recipe as a review row, in part order — the same order
 * the parts' own lines are in, which is how the draft puts each row back on the
 * part it came from. Pure.
 */
export function reviewRowsFromMealie<U extends UnitCandidate, F extends FoodCandidate>(
  recipe: MealieRecipe,
  vocabulary: { units: readonly U[]; foods: readonly F[] }
): { rows: ReviewRow<U, F>[] } {
  const rows: ReviewRow<U, F>[] = [];
  for (const part of recipe.parts) {
    for (const row of part.rows) rows.push(reviewRowFromMealie(row, String(rows.length), vocabulary));
  }
  return { rows };
}
