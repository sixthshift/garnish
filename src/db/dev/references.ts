import type { Food, Tag, Unit } from "../../domain/reference";
import { slugify } from "../../lib/names";
import { correctedStarterFoods } from "../seed/foodPlurals";
import { STARTER_AISLES } from "../seed/foods";
import { DEFAULT_UNITS } from "../seed/units";

/**
 * How dev data names the reference rows its recipes use. Units, aisles and
 * foods are the seed's, never dev's own: a dev recipe refers to them by name,
 * the recipe repository links that name to the row the seed made, and a name
 * the seed does not have throws here rather than quietly creating a food or
 * a unit no real database would have. Tags are the exception, because tags
 * are a household's own and the seed has none.
 */

// The repository resolves a reference by name when this id is not found, so
// the documents carry no real ids of their own and never keep this one.
export const NEW = "00000000-0000-4000-8000-000000000000";

const foods = new Map(correctedStarterFoods().map((food) => [food.name, food]));

/** Every unit the seed makes, by name: what a generated row draws its unit from. */
export const SEEDED_UNIT_NAMES: readonly string[] = DEFAULT_UNITS.map((unit) => unit.name);

/** Every food the seed makes, by name: what a generated row draws its food from. */
export const SEEDED_FOOD_NAMES: readonly string[] = [...foods.keys()];

/** A reference to the seeded unit of this name. Throws for a name the seed does not have. */
export function unitRef(name: string): Unit {
  const known = DEFAULT_UNITS.find((unit) => unit.name === name);
  if (known === undefined) throw new Error(`"${name}" is not a seeded unit`);
  return {
    id: NEW,
    name,
    pluralName: known.pluralName ?? null,
    abbreviation: known.abbreviation ?? "",
    useAbbreviation: known.useAbbreviation ?? false,
    fraction: known.fraction ?? true,
    portion: known.portion ?? false,
    standardQuantity: null,
    standardUnitId: null,
  };
}

/** A reference to the seeded food of this name, in its seeded aisle. Throws for a name the seed does not have. */
export function foodRef(name: string): Food {
  const known = foods.get(name);
  if (known === undefined) throw new Error(`"${name}" is not a seeded food`);
  return {
    id: NEW,
    name,
    pluralName: known.plural ?? null,
    aliases: [],
    aisle: { id: NEW, name: known.aisle, position: STARTER_AISLES.indexOf(known.aisle) },
    recipeId: null,
    skipShopping: known.skipShopping ?? false,
    conversions: [],
  };
}

/** A reference to a tag of this name, made if the database has none. */
export function tagRef(name: string): Tag {
  return { id: NEW, name, slug: slugify(name) };
}
