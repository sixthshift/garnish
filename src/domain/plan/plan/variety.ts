import type { Facets } from "../../recipes/recipe";

// A varied week (decisions.md row 212), read off what the household said each
// recipe is (row 209): no main ingredient two nights running, no cuisine more
// than twice in the week, and as many vegetarian nights as the household asks
// for, spread through the week rather than bunched at its end. Nothing here
// knows a recipe nobody has marked: a recipe with no main ingredient clashes
// with nothing, one with no cuisine counts towards none. When the rules ask for
// more than the library can give they give way one at a time, the cuisine
// spread first, then the main ingredient, and the vegetarian nights, which the
// household set by hand, last; a night is only ever left empty when nothing at
// all is left. Pure.

/** What the rules read of a recipe. */
export type VarietyRecipe = { id: string; facets: Pick<Facets, "mainIngredient" | "cuisine" | "diet"> };

/** The most dinners of one cuisine in a week before the rules look elsewhere. */
export const CUISINE_CAP = 2;

/** The most vegetarian nights a household can ask for: every weeknight. */
export const MAX_VEGETARIAN_NIGHTS = 5;

/** Whether a recipe is vegetarian as written: said vegetarian or vegan. */
export function isVegetarian(recipe: VarietyRecipe): boolean {
  return recipe.facets.diet.includes("vegetarian") || recipe.facets.diet.includes("vegan");
}

/** Whether two recipes share a main ingredient; a recipe with none said shares nothing. */
export function sameMainIngredient(a: VarietyRecipe | undefined, b: VarietyRecipe | undefined): boolean {
  if (!a || !b) return false;
  return a.facets.mainIngredient.some((value) => (b.facets.mainIngredient as readonly string[]).includes(value));
}

/** Whether adding `recipe` to `others` takes one of its cuisines past the cap. */
export function overCuisineCap(recipe: VarietyRecipe, others: readonly VarietyRecipe[]): boolean {
  return recipe.facets.cuisine.some((cuisine) => others.filter((other) => (other.facets.cuisine as readonly string[]).includes(cuisine)).length >= CUISINE_CAP);
}

/**
 * Which of `count` nights are the vegetarian ones when `wanted` are asked
 * for: spread through the week, the middle of each equal share, so two of five
 * are Tuesday and Thursday. Pure.
 */
export function vegetarianNightIndexes(count: number, wanted: number): Set<number> {
  const n = Math.max(0, Math.min(wanted, count));
  return new Set(Array.from({ length: n }, (_, i) => Math.floor(((i + 0.5) * count) / n)));
}

/** A candidate's fit for one night, as tiers: 3 fits every rule, 2 all but the cuisine spread, 1 only the vegetarian night, 0 none. */
function fitFor(recipe: VarietyRecipe, neighbours: readonly (VarietyRecipe | undefined)[], others: readonly VarietyRecipe[], needsVegetarian: boolean): number {
  if (needsVegetarian && !isVegetarian(recipe)) return 0;
  if (neighbours.some((neighbour) => sameMainIngredient(recipe, neighbour))) return 1;
  if (overCuisineCap(recipe, others)) return 2;
  return 3;
}

/** The first candidate of the best tier present, keeping the candidates' own order within it (the rotation's: longest since made first). */
function best<T extends VarietyRecipe>(candidates: readonly T[], score: (recipe: T) => number): T | undefined {
  let chosen: T | undefined;
  let top = -1;
  for (const candidate of candidates) {
    const s = score(candidate);
    if (s > top) {
      top = s;
      chosen = candidate;
      if (s === 3) break;
    }
  }
  return chosen;
}

/**
 * The weeknights' first offer, `count` nights from what did not happen last
 * week then the rotation, in that order of preference, varied by the rules
 * above. A night with nothing left is null, a night off. Pure.
 */
export function varyNights<T extends VarietyRecipe>(count: number, candidates: readonly T[], vegetarianNights = 0): (string | null)[] {
  const unique = [...new Map(candidates.map((recipe) => [recipe.id, recipe])).values()];
  const target = Math.min(vegetarianNights, count);
  const marked = vegetarianNightIndexes(count, target);
  const chosen: (T | undefined)[] = [];
  for (let night = 0; night < count; night++) {
    const vegetarianSoFar = chosen.filter((recipe) => recipe && isVegetarian(recipe)).length;
    const stillWanted = target - vegetarianSoFar;
    // A marked night wants one; so does any night once the rest are all needed to reach the number.
    const needsVegetarian = stillWanted > 0 && (marked.has(night) || stillWanted >= count - night);
    const taken = new Set(chosen.flatMap((recipe) => (recipe ? [recipe.id] : [])));
    const others = chosen.filter((recipe): recipe is T => recipe !== undefined);
    const pick = best(
      unique.filter((recipe) => !taken.has(recipe.id)),
      (recipe) => fitFor(recipe, [chosen[night - 1]], others, needsVegetarian)
    );
    chosen.push(pick);
  }
  return chosen.map((recipe) => recipe?.id ?? null);
}

/**
 * Night `index` swapped for the next recipe in `pool` after its own that no
 * other night holds, wrapping round, preferring one that keeps the week
 * varied: no main ingredient shared with the nights either side, no cuisine
 * past the cap, and a vegetarian night kept vegetarian while the week needs
 * it. `byId` finds the other nights' recipes, which need not be in the pool.
 * Unchanged when the pool has nothing else to give. Pure.
 */
export function swapVaried<T extends VarietyRecipe>(
  nights: readonly (string | null)[],
  index: number,
  pool: readonly T[],
  byId: ReadonlyMap<string, VarietyRecipe>,
  vegetarianNights = 0
): (string | null)[] {
  const current = nights[index] ?? null;
  const start = pool.findIndex((recipe) => recipe.id === current);
  const ordered = Array.from({ length: pool.length }, (_, step) => pool[(start + 1 + step + pool.length) % pool.length]!).filter(
    (recipe) => !nights.includes(recipe.id)
  );
  const recipe = (id: string | null | undefined) => (id ? byId.get(id) : undefined);
  const others = nights.flatMap((id, i) => (i === index ? [] : [recipe(id)].filter((r): r is VarietyRecipe => r !== undefined)));
  const currentRecipe = recipe(current);
  const needsVegetarian =
    currentRecipe !== undefined && isVegetarian(currentRecipe) && others.filter(isVegetarian).length < Math.min(vegetarianNights, nights.length);
  const pick = best(ordered, (candidate) => fitFor(candidate, [recipe(nights[index - 1]), recipe(nights[index + 1])], others, needsVegetarian));
  if (!pick) return [...nights];
  return nights.map((id, i) => (i === index ? pick.id : id));
}
