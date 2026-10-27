/**
 * The third starter batch: the sizes common foods are sold in (decisions.md
 * row 184), so the shopping list rounds "150 g butter" up to a 250 g block
 * from the first week. Australian supermarket sizes, kept to the ones that
 * hold across the big chains; a food sold by weight off the counter (cheese,
 * meat) or by the sheet (pastry) has none, since no one size is right.
 *
 * Applied once per database, after the first two batches: a starter food
 * still named as here and with no sizes of its own gets these. A food the
 * household renamed, deleted or already gave sizes to is left alone, and
 * so is a size whose unit the household has deleted.
 */

import type { Database } from "bun:sqlite";
import type { FoodPackInput } from "../../domain/reference";
import { foodRepository } from "../models/food/repo";
import { seedBatchRepository } from "../models/seed/repo";
import { unitRepository } from "../models/unit/repo";

/** The batch name `seed_batch` records. */
export const STARTER_PACKS_BATCH = "starter-packs-1";

/** One size: an amount and a starter unit's name, or null for "each". */
export type StarterSize = readonly [quantity: number, unit: "gram" | "kilogram" | "millilitre" | "litre" | "can" | null];

export type StarterPack = { food: string; sizes: readonly StarterSize[] };

const g = (quantity: number): StarterSize => [quantity, "gram"];
const kg = (quantity: number): StarterSize => [quantity, "kilogram"];
const ml = (quantity: number): StarterSize => [quantity, "millilitre"];
const l = (quantity: number): StarterSize => [quantity, "litre"];
const each = (quantity: number): StarterSize => [quantity, null];
/** A tin, counted either way a recipe writes it: "1 can" or "400 g". */
const tin = (grams: number): StarterSize[] => [[1, "can"], g(grams)];

export const STARTER_PACKS: readonly StarterPack[] = [
  // Dairy & eggs
  { food: "butter", sizes: [g(250), g(500)] },
  { food: "unsalted butter", sizes: [g(250)] },
  { food: "thickened cream", sizes: [ml(300), ml(600)] },
  { food: "pure cream", sizes: [ml(300)] },
  { food: "double cream", sizes: [ml(300)] },
  { food: "sour cream", sizes: [g(300)] },
  { food: "milk", sizes: [l(1), l(2)] },
  { food: "greek yoghurt", sizes: [g(500), kg(1)] },
  { food: "natural yoghurt", sizes: [g(500), kg(1)] },
  { food: "cream cheese", sizes: [g(250)] },
  { food: "mascarpone", sizes: [g(250)] },
  { food: "egg", sizes: [each(6), each(12)] },
  // Tins and jars
  { food: "canned tomatoes", sizes: tin(400) },
  { food: "canned cherry tomatoes", sizes: tin(400) },
  { food: "chickpeas", sizes: tin(400) },
  { food: "cannellini beans", sizes: tin(400) },
  { food: "black beans", sizes: tin(400) },
  { food: "kidney beans", sizes: tin(400) },
  { food: "coconut milk", sizes: [[1, "can"], ml(270), ml(400)] },
  { food: "coconut cream", sizes: [[1, "can"], ml(270), ml(400)] },
  { food: "evaporated milk", sizes: [ml(375)] },
  { food: "sweetened condensed milk", sizes: [g(395)] },
  { food: "tuna", sizes: [g(95), g(185)] },
  { food: "tomato paste", sizes: [g(140)] },
  { food: "passata", sizes: [g(700)] },
  // Stock
  { food: "chicken stock", sizes: [ml(500), l(1)] },
  { food: "beef stock", sizes: [ml(500), l(1)] },
  { food: "vegetable stock", sizes: [ml(500), l(1)] },
  // Baking
  { food: "plain flour", sizes: [kg(1)] },
  { food: "self-raising flour", sizes: [kg(1)] },
  { food: "caster sugar", sizes: [kg(1)] },
  { food: "brown sugar", sizes: [kg(1)] },
  { food: "icing sugar", sizes: [g(500)] },
  { food: "instant dried yeast", sizes: [g(7)] },
  // Rice and pasta
  { food: "arborio rice", sizes: [g(500), kg(1)] },
  { food: "basmati rice", sizes: [kg(1)] },
  { food: "jasmine rice", sizes: [kg(1)] },
  { food: "spaghetti", sizes: [g(500)] },
  // Fruit & veg
  { food: "baby spinach", sizes: [g(120), g(280)] },
];

/**
 * Give each starter food still named as in `STARTER_PACKS`, and with no
 * sizes yet, its sizes; once per database. Returns the foods given sizes on
 * this run.
 */
export function seedStarterPacks(db: Database, packs: readonly StarterPack[] = STARTER_PACKS): string[] {
  const batches = seedBatchRepository(db);
  if (batches.applied(STARTER_PACKS_BATCH)) return [];

  const foods = foodRepository(db);
  const fold = (name: string) => name.trim().toLowerCase();
  const foodByName = new Map(foods.list().map((food) => [fold(food.name), food]));
  const unitByName = new Map(
    unitRepository(db)
      .list()
      .map((unit) => [fold(unit.name), unit])
  );
  const sized = new Set(foods.packs().map((pack) => pack.foodId));

  const given: string[] = [];
  for (const { food: name, sizes } of packs) {
    const food = foodByName.get(fold(name));
    if (food === undefined || sized.has(food.id)) continue;
    const inputs = sizes.flatMap(([quantity, unitName]): FoodPackInput[] => {
      if (unitName === null) return [{ quantity, unitId: null }];
      const unit = unitByName.get(unitName);
      return unit === undefined ? [] : [{ quantity, unitId: unit.id }];
    });
    if (inputs.length === 0) continue;
    foods.setPacks(food.id, inputs);
    given.push(food.name);
  }
  batches.record(STARTER_PACKS_BATCH);
  return given;
}
