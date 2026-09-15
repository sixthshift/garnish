/** One part of a scraped recipe: a name (empty for the main body), its raw ingredient lines and its steps. */
export type ScrapedPart = { name: string; ingredients: string[]; steps: string[] };

/** A schema.org Recipe as this app's fields. Text only — no ids, nothing resolved. */
export type ScrapedRecipe = {
  name: string;
  description: string;
  /** The first usable image URL, or null. */
  image: string | null;
  /** A number to scale by; 0 when the page did not say. */
  servings: number;
  /** What it makes, minus the count: "muffins", "loaf". Empty when the yield was only a number. */
  yieldText: string;
  prepMinutes: number | null;
  cookMinutes: number | null;
  tags: string[];
  /** At least one part; the unnamed one is the main body. Each owns its ingredient lines, for `parseIngredient`, and its steps. */
  parts: ScrapedPart[];
};
