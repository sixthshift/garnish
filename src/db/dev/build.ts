import type { z } from "zod";
import type { alternativeSchema, ingredientInputSchema, RecipeInput } from "../../domain/recipes/recipe";
import { foodRef, unitRef } from "./references";

/**
 * The pieces the dev library's recipes are written with (`./recipes/`). A dev
 * recipe is hand-written in the house style (decisions.md row 124) and names
 * the seed's units and foods by name (`./references.ts`, which throws for a
 * name the seed does not have).
 */

export { tagRef as tag, unitRef as unit } from "./references";

type Ing = z.input<typeof ingredientInputSchema>;
type Alt = z.input<typeof alternativeSchema>;

/** One "made this" in the cook log, so many days before the seed runs. */
export type DevCook = { daysAgo: number; message: string; servings: number | null };

/**
 * One recipe of the dev library: the document, plus what the repository will
 * not take from a document. Ages are days before the seed runs, so a fresh
 * database always reads as recently used: "made 3 days ago" stays true.
 */
export type DevRecipe = {
  input: RecipeInput;
  createdDaysAgo: number;
  /** At or after created, so no more days ago than `createdDaysAgo`. */
  updatedDaysAgo: number;
  cooks: readonly DevCook[];
  /** The recipe's photo, a file in `./images/`, or null for a recipe with none. */
  image: string | null;
  /** The seeded food this recipe makes, linked to it as a sub-recipe (`food.recipe_id`, decisions.md row 70). */
  makesFood?: string;
  /** Photos for some of its steps, by the step's id: files in `./images/`. */
  stepImages?: readonly { stepId: string; file: string }[];
};

/**
 * A fixed v4-shaped id from a label, so a step can name its rows and the
 * plan can name a recipe. Labels start with the recipe's slug so they stay
 * unique across the library (a test checks).
 */
export function fixedId(label: string): string {
  let a = 0;
  let b = 7;
  for (let i = 0; i < label.length; i += 1) {
    a = (a * 31 + label.charCodeAt(i)) >>> 0;
    b = (b * 131 + label.charCodeAt(i)) >>> 0;
  }
  const hex = (n: number, width: number) => n.toString(16).padStart(width, "0").slice(-width);
  return `${hex(a, 8)}-${hex(b >>> 16, 4)}-4${hex(b, 3)}-a${hex(a >>> 20, 3)}-${hex(b, 8)}${hex(a, 4)}`;
}

/** `quantity unit food, note`, with its own id so a step can link it. A null unit is a count ("2 carrots"). */
export function ing(
  id: string,
  quantity: number | null,
  unitName: string | null,
  foodName: string,
  opts: { note?: string; fixed?: boolean; alternatives?: Alt[] } = {}
): Ing {
  return {
    id,
    quantity,
    unit: unitName ? unitRef(unitName) : null,
    food: foodRef(foodName),
    note: opts.note ?? "",
    fixed: opts.fixed ?? false,
    originalText: "",
    alternatives: opts.alternatives ?? [],
  };
}

/** A line kept verbatim: no food, no amount. */
export function raw(id: string, originalText: string): Ing {
  return { id, quantity: null, unit: null, food: null, note: "", originalText, fixed: false };
}

/** One food in a line's place: one-for-one, or its own amount against the alternative's basis. */
export function item(foodName: string, quantity: number | null = null, unitName: string | null = null) {
  return { quantity, unit: unitName ? unitRef(unitName) : null, food: foodRef(foodName) };
}

/** A labelled step with its supporting line ('' for none) and the rows of its own part it uses. */
export function step(id: string, title: string, text: string, summary: string, ingredientIds: string[] = []) {
  return { id, title, text, summary, ingredientIds, image: null };
}

/** A "made this", `daysAgo` days before the seed runs. */
export function cook(daysAgo: number, message: string, servings: number | null = null): DevCook {
  return { daysAgo, message, servings };
}
