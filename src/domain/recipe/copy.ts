// Plain text for the clipboard: what "Copy ingredients" puts on it. Pure: no
// IO, no clipboard, importable by the client.
//
// Mealie's copy button hands over the ingredient lines as text, one per line.
// Here the recipe's parts each contribute a heading (a named part only — the
// unnamed part has nothing to head) followed by its lines, so a pasted list of
// a multi-part recipe still says which ingredients belong to what. Empty lines
// and empty parts are dropped; a recipe with nothing to copy yields "".
import { formatIngredient } from "../ingredient/format";
import type { Ingredient, Part } from "./recipe";

export type CopyRecipe = { name: string; parts: ReadonlyArray<Pick<Part, "name" | "ingredients">> };

/** One ingredient per line, headed by the recipe name. Pure. */
export function ingredientsText(recipe: CopyRecipe): string {
  const blocks: string[] = [];

  for (const part of recipe.parts) {
    const lines = ingredientLines(part.ingredients);
    if (lines.length === 0) continue;
    const name = part.name.trim();
    blocks.push(name === "" ? lines.join("\n") : [`${name}:`, ...lines].join("\n"));
  }

  if (blocks.length === 0) return "";
  const title = recipe.name.trim();
  return [...(title === "" ? [] : [title, ""]), blocks.join("\n\n")].join("\n");
}

/** The non-empty formatted lines of one ingredient list. Pure. */
export function ingredientLines(ingredients: ReadonlyArray<Ingredient>): string[] {
  return ingredients.map((ingredient) => formatIngredient(ingredient)).filter((line) => line.trim() !== "");
}

/**
 * The link "Copy link" puts on the clipboard: the recipe's own page on this
 * host, without any `servings` the reader happens to be scaled to. A trailing
 * slash on the origin is dropped. Pure.
 */
export function recipeUrl(origin: string, slug: string): string {
  return `${origin.trim().replace(/\/+$/, "")}/recipes/${slug}`;
}
