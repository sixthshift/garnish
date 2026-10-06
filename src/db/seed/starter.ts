import type { Database } from "bun:sqlite";
import { type Aisle, aisleRepository } from "../models/aisle/repo";
import { type Food, foodRepository } from "../models/food/repo";
import { seedBatchRepository } from "../models/seed/repo";
import { FOOD_PLURALS, FOOD_PLURALS_BATCH, type FoodCorrection } from "./foodPlurals";
import { STARTER_AISLES, STARTER_FOODS, type StarterAisle, type StarterFood } from "./foods";

/** The batch name `seed_batch` records. A later addition to the list is a new batch with a new name. */
export const STARTER_BATCH = "starter-foods-1";

/** What the batch did: the aisles and foods it created, and the existing foods it gave aliases to. */
export type StarterResult = { aisles: Aisle[]; foods: Food[]; aliasedFoods: Food[] };

const fold = (text: string) => text.trim().toLowerCase();

/** Every word the matcher reads a food by: its name, its plural and its aliases. */
const wordsOf = (food: { name: string; pluralName?: string | null; aliases?: readonly string[] }): string[] =>
  [food.name, food.pluralName ?? "", ...(food.aliases ?? [])].filter((word) => word.trim() !== "");

/**
 * Give this database the starter aisles and foods (`foods.ts`), once. A
 * database that has had the batch is left alone, so a starter food the
 * household renamed, merged or deleted is never brought back.
 *
 * The household's own rows win throughout. An aisle is matched by name,
 * case-insensitively, and a missing one goes at the end in walking order. A
 * starter food is skipped when an existing food already answers to its name
 * — as a name, a plural or an alias — and one that goes in leaves out any
 * plural or alias an existing food answers to, so a line still reads as the
 * household's food. An existing food with the starter food's own name is the
 * same food: it gains the aliases nothing else claims and is otherwise
 * unchanged.
 *
 * The caller owns the transaction: `seed()` runs this with the units and the
 * guides in one.
 */
export function seedStarterFoods(db: Database, foodsList: readonly StarterFood[] = STARTER_FOODS): StarterResult {
  const batches = seedBatchRepository(db);
  const none: StarterResult = { aisles: [], foods: [], aliasedFoods: [] };
  if (batches.applied(STARTER_BATCH)) return none;

  const aisleRepo = aisleRepository(db);
  const foodRepo = foodRepository(db);

  const aisleByName = new Map(aisleRepo.list().map((row) => [fold(row.name), row]));
  const aisleIds = new Map<StarterAisle, string>();
  const madeAisles: Aisle[] = [];
  for (const name of STARTER_AISLES) {
    let row = aisleByName.get(fold(name));
    if (row === undefined) {
      row = aisleRepo.create({ name });
      madeAisles.push(row);
    }
    aisleIds.set(name, row.id);
  }

  // Which food each word already reads as. Filled as the batch goes, so two
  // starter foods can never claim one word either.
  const claimed = new Map<string, Food>();
  const claim = (food: Food) => {
    for (const word of wordsOf(food)) if (!claimed.has(fold(word))) claimed.set(fold(word), food);
  };
  const existing = foodRepo.list();
  for (const food of existing) claim(food);
  const byName = new Map(existing.map((food) => [fold(food.name), food]));

  const madeFoods: Food[] = [];
  const aliasedFoods: Food[] = [];
  for (const input of foodsList) {
    const free = (input.aliases ?? []).filter((alias) => !claimed.has(fold(alias)));
    const same = byName.get(fold(input.name));
    if (same !== undefined) {
      const known = new Set(wordsOf(same).map(fold));
      const added = free.filter((alias) => !known.has(fold(alias)));
      if (added.length === 0) continue;
      const updated = foodRepo.update(same.id, { aliases: [...same.aliases, ...added] });
      if (updated === null) continue;
      aliasedFoods.push(updated);
      claim(updated);
      continue;
    }
    if (claimed.has(fold(input.name))) continue;
    const plural = input.plural !== undefined && input.plural !== input.name && claimed.has(fold(input.plural)) ? null : (input.plural ?? null);
    const food = foodRepo.create({
      name: input.name,
      pluralName: plural,
      aliases: free,
      aisleId: aisleIds.get(input.aisle) ?? null,
      skipShopping: input.skipShopping ?? false,
    });
    madeFoods.push(food);
    claim(food);
  }

  batches.record(STARTER_BATCH);
  return { aisles: madeAisles, foods: madeFoods, aliasedFoods };
}

/**
 * Apply the plurals batch (`foodPlurals.ts`) once, after the starter batch.
 * Each correction finds its food by the first batch's name and touches only
 * what is still as that batch left it:
 *
 * - a rename goes ahead unless another food answers to the new name; the new
 *   name leaves the aliases, and the old name becomes the plural when the
 *   food has none of its own;
 * - a plural replaces the first batch's plural, never one the household set;
 * - an alias goes in when no food answers to it yet.
 *
 * A food that is gone, or renamed by the household, is skipped. Returns the
 * foods it changed. The caller owns the transaction.
 */
export function seedFoodPlurals(
  db: Database,
  corrections: readonly FoodCorrection[] = FOOD_PLURALS,
  firstBatch: readonly StarterFood[] = STARTER_FOODS
): Food[] {
  const batches = seedBatchRepository(db);
  if (batches.applied(FOOD_PLURALS_BATCH)) return [];

  const foodRepo = foodRepository(db);
  const foods = foodRepo.list();
  const byName = new Map(foods.map((food) => [fold(food.name), food]));
  const owner = new Map<string, string>();
  for (const food of foods) for (const word of wordsOf(food)) if (!owner.has(fold(word))) owner.set(fold(word), food.id);
  const claimedByOther = (word: string, id: string) => {
    const by = owner.get(fold(word));
    return by !== undefined && by !== id;
  };
  const firstPlural = new Map(firstBatch.map((food) => [fold(food.name), food.plural ?? null]));

  const changed: Food[] = [];
  for (const correction of corrections) {
    const food = byName.get(fold(correction.name));
    if (food === undefined) continue;
    let { name, pluralName, aliases } = food;

    if (correction.rename !== undefined && !claimedByOther(correction.rename, food.id)) {
      const singular = correction.rename;
      aliases = aliases.filter((alias) => fold(alias) !== fold(singular));
      if (pluralName === null || pluralName.trim() === "") pluralName = name;
      name = singular;
    }
    if (correction.plural !== undefined && (food.pluralName ?? null) === (firstPlural.get(fold(correction.name)) ?? null)) {
      if (correction.plural === null || !claimedByOther(correction.plural, food.id)) pluralName = correction.plural;
    }
    const known = new Set([name, pluralName ?? "", ...aliases].map(fold));
    const added = (correction.aliases ?? []).filter((alias) => !known.has(fold(alias)) && !owner.has(fold(alias)));
    aliases = [...aliases, ...added];

    if (name === food.name && pluralName === food.pluralName && aliases.length === food.aliases.length) continue;
    const updated = foodRepo.update(food.id, { name, pluralName, aliases });
    if (updated === null) continue;
    for (const word of wordsOf(updated)) if (!owner.has(fold(word))) owner.set(fold(word), updated.id);
    changed.push(updated);
  }

  batches.record(FOOD_PLURALS_BATCH);
  return changed;
}
