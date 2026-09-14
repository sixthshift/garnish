// Structured vs. Summary (M11.3, src/lib/prefs.ts IngredientMode): flattens a
// recipe's per-part ingredient blocks into one list for the "Summary" view. Pure: no IO, importable by the client.
//
// Mirrors the shopping list's merge rule (decisions.md row 13): lines are
// merged by food and unit, quantities summed. Two exceptions, both because
// summing would misrepresent the recipe:
//   - a `fixed` ingredient (Cooklang `=`, does not scale — see scale.ts) keeps
//     its own line even when another line shares its food and unit;
//   - a null-quantity ingredient ("salt to taste", nothing to sum) likewise
//     keeps its own line.
// A food-less line (parsing failed; only `originalText` survived) is keyed by
// that text instead of a food id, so two unrelated unparsed lines never merge
// into each other, but identical ones do.
//
// Within a merge group, `note` is kept only when every merged line shares the
// same (trimmed) note; a group whose notes disagree shows none rather than
// picking one arbitrarily. A group's id is its first member's id, so a
// singleton group (the common case — most food/unit pairs appear once) keeps
// the same tick state (src/lib/ticks.ts) whichever view is showing.
import type { Ingredient, Part } from "../recipe/recipe";

/** True for ingredients that fold into a summed group; false for lines kept on their own. */
function isMergeable(ingredient: Ingredient): boolean {
  return !ingredient.fixed && ingredient.quantity !== null;
}

/** Merge identity: same food (or, lacking one, the same raw text) and the same unit. */
function mergeKey(ingredient: Ingredient): string {
  const foodKey = ingredient.food !== null ? `food:${ingredient.food.id}` : `raw:${ingredient.originalText.trim()}`;
  const unitKey = ingredient.unit !== null ? `unit:${ingredient.unit.id}` : "unit:none";
  return `${foodKey}|${unitKey}`;
}

/**
 * One flat ingredient list for the whole recipe: every part's ingredients, in
 * order, merged by food and unit with quantities summed.
 * `fixed` and null-quantity lines never merge, even with a matching food and
 * unit, and appear once per occurrence. Pure; the input is not mutated.
 */
export function mergeIngredients(recipe: { parts: ReadonlyArray<Pick<Part, "ingredients">> }): Ingredient[] {
  const merged: Ingredient[] = [];
  const groups = new Map<string, Ingredient>();

  for (const part of recipe.parts) {
    for (const ingredient of part.ingredients) {
      const { quantity, fixed, note } = ingredient;
      if (fixed || quantity === null) {
        merged.push({ ...ingredient });
        continue;
      }

      const key = mergeKey(ingredient);
      const existing = groups.get(key);
      if (existing === undefined) {
        const created = { ...ingredient };
        groups.set(key, created);
        merged.push(created);
        continue;
      }

      existing.quantity = (existing.quantity ?? 0) + quantity;
      if (existing.note.trim() !== note.trim()) existing.note = "";
    }
  }

  return merged;
}
