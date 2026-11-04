import type { ScrapedPart, ScrapedRecipe } from "../../scraped/types";

/** One of Mealie's ingredient rows, already parsed by Mealie. */
export type MealieIngredient = {
  /** The line as Mealie kept it, never lost. */
  originalText: string;
  quantity: number | null;
  /** The unit's name, or "" when the row had none. */
  unit: string;
  /** The food's name, or "" when the row was not a structured one. */
  food: string;
  note: string;
};

/**
 * A part as this import builds it: Mealie's section, owning both its
 * ingredients and its steps. `ingredients` holds the lines, which is what a
 * `ScrapedPart` is, so a Mealie part is one; `rows` holds the same
 * rows with the structure Mealie had already parsed out of them — the food,
 * the unit, the quantity — which a line cannot carry and which the review
 * would otherwise have to guess at a second time.
 */
export type MealiePart = ScrapedPart & { rows: MealieIngredient[] };

/**
 * A Mealie recipe as this app's fields. A `ScrapedRecipe` with the structure
 * Mealie actually has — parts that own their rows, plus the notes, rating and
 * source it carries — so it lands on the same review step a scraped page does.
 */
export type MealieRecipe = Omit<ScrapedRecipe, "parts"> & {
  /** Which export this came out of, so the review and the draft can tell. */
  source: "mealie";
  parts: MealiePart[];
  notes: { title: string; text: string }[];
  rating: number | null;
  /** Mealie's `orgURL`; "" when the recipe was typed in rather than imported. */
  sourceUrl: string;
  /** Mealie's own id, used to find the recipe's image in a backup zip. */
  sourceId: string;
};
