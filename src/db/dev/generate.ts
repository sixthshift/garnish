// Builds the dev dataset. Pure: no database, no disk, no clock — everything is
// derived from the seed, so the same seed always produces the same fifteen
// recipes with the same timestamps. ./apply.ts is what writes them.
//
// The point of the mix is coverage, not realism. Across the set there is
// always at least one of each of: a flat recipe, a recipe with several named
// parts, one with no rating, one never made, one with no image, one with
// a source URL, one with a very long name, one with a single ingredient, and
// one with many. The list, filter, sort and cook screens all have an awkward
// case to render.
import type { z } from "zod";
import { slugify } from "../../lib/names";
import { type ingredientInputSchema, type RecipeInput, type TimelineEventInput, suggestLinks } from "../../domain/recipe";
import type { Food, Tag, Unit } from "../../domain/reference";
import { DEFAULT_UNITS } from "../seed/units";
import { random, type Random } from "./random";
import { AISLES, DESCRIPTIONS, DOUBLE_STEPS, FOODS, type FoodEntry, NOTES, SHAPES, SOURCES, STEPS, TAGS, UNITS } from "./vocabulary";

/** The seed the dataset is built from. Changing it changes every recipe. */
export const DEV_SEED = "garnish-dev-data-v1";

/** How many recipes `bun run dev:data` creates. */
export const DEV_RECIPE_COUNT = 15;

/** The clock the dataset is anchored to, so timestamps do not drift between runs. */
export const DEV_EPOCH = Date.UTC(2026, 8, 1); // 2026-09-01

/**
 * One generated recipe: the document, plus the stamps and events that the
 * repository will not take from a document. `createdAt`/`updatedAt` are
 * applied by ./apply.ts after the insert, because `create()` always stamps
 * them with the current time and sorting by either needs a real spread.
 */
export type DevRecipe = {
  input: RecipeInput;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEventInput[];
  /** Hue (0-359) for the generated placeholder image, or null for the recipes that have none. */
  imageHue: number | null;
};

// Reference rows are resolved by name (case-insensitive) and created when
// missing, so the documents carry no real ids. Same convention as the seed.
const NEW = "00000000-0000-4000-8000-000000000000";

type Ing = z.input<typeof ingredientInputSchema>;

/**
 * A generated row, settled enough for `suggestLinks` to match and name it: a
 * real id (rather than the optional one the write shape allows) and a food
 * that is present or plainly absent, never merely omitted.
 */
type LinkableIngredient = Omit<Ing, "id" | "food"> & { id: string; food: Food | null };

/** A generated step, settled enough to pass through `suggestLinks`. */
type LinkableStep = { id: string; text: string; ingredientIds: string[] };

function unitRef(name: string): Unit {
  const known = DEFAULT_UNITS.find((u) => u.name === name);
  return {
    id: NEW,
    name,
    pluralName: known?.pluralName ?? null,
    abbreviation: known?.abbreviation ?? "",
    useAbbreviation: known?.useAbbreviation ?? false,
    fraction: known?.fraction ?? true,
    standardQuantity: null,
    standardUnitId: null,
  };
}

function foodRef(entry: FoodEntry): Food {
  return {
    id: NEW,
    name: entry.name,
    pluralName: entry.plural ?? null,
    aliases: [],
    aisle: { id: NEW, name: entry.aisle, position: AISLES.indexOf(entry.aisle) },
    recipeId: null,
    skipShopping: false,
    conversions: [],
  };
}

/** An ISO timestamp `days` before the epoch. */
function daysBefore(days: number): string {
  return new Date(DEV_EPOCH - days * 86_400_000).toISOString();
}

/** A `YYYY-MM-DD` date `days` before the epoch. */
function dateBefore(days: number): string {
  return daysBefore(days).slice(0, 10);
}

/** A quantity that reads like a person wrote it, scaled to what the unit implies. */
function quantityFor(rng: Random, unitName: string): number {
  switch (unitName) {
    case "gram":
      return rng.pick([50, 100, 150, 200, 250, 300, 400, 500]);
    case "kilogram":
      return rng.pick([1, 1.5, 2]);
    case "millilitre":
      return rng.pick([50, 100, 200, 250, 375, 500]);
    case "litre":
      return rng.pick([1, 1.5, 2]);
    case "teaspoon":
    case "tablespoon":
      return rng.pick([0.5, 1, 1.5, 2, 3]);
    case "cup":
      return rng.pick([0.25, 0.5, 1, 1.5, 2]);
    default:
      return rng.int(1, 6);
  }
}

function ingredient(rng: Random, entry: FoodEntry): LinkableIngredient {
  // A few lines carry no amount at all ("salt, to taste"), and a few are fixed
  // so they do not scale with servings.
  const noAmount = rng.chance(0.1);
  const unitName = rng.pick(UNITS);
  return {
    id: devId(rng),
    quantity: noAmount ? null : quantityFor(rng, unitName),
    unit: noAmount ? null : unitRef(unitName),
    food: foodRef(entry),
    note: rng.chance(0.25) ? rng.pick(["finely chopped", "roughly torn", "at room temperature", "plus extra to serve", "drained and rinsed"]) : "",
    fixed: rng.chance(0.08),
    originalText: "",
  };
}

/** A line kept verbatim: no food, no amount, only the text. */
function rawIngredient(rng: Random, text: string): LinkableIngredient {
  return { id: devId(rng), quantity: null, unit: null, food: null, note: "", originalText: text, fixed: false };
}

function stepText(rng: Random, pool: readonly FoodEntry[]): string {
  const template = rng.pick(STEPS);
  return template.replace(/\{food\}/g, () => rng.pick(pool).name);
}

/**
 * A step that plainly names two distinct rows from `pool` at once, so
 * `suggestLinks` always has something to link twice over. `pool` must have
 * at least two entries; callers check `foods.length >= 2` first.
 */
function doubleStepText(rng: Random, pool: readonly FoodEntry[]): string {
  const [a, b] = rng.sample(pool, 2) as [FoodEntry, FoodEntry];
  const template = rng.pick(DOUBLE_STEPS);
  let first = true;
  return template.replace(/\{food\}/g, () => {
    const chosen = first ? a : b;
    first = false;
    return chosen.name;
  });
}

/**
 * Tags weighted towards the front of TAGS, so the first few land on many
 * recipes and the last few on one or two.
 */
function pickTags(rng: Random, shapeTags: readonly string[]): Tag[] {
  const names = new Set(shapeTags);
  const extra = rng.int(0, 2);
  for (let i = 0; i < extra; i += 1) {
    // Squaring a uniform draw biases towards the low indices.
    const draw = rng.next() ** 2;
    names.add(TAGS[Math.floor(draw * TAGS.length)]!);
  }
  return [...names].map((name) => ({ id: NEW, name, slug: slugify(name) }));
}

/**
 * A deterministic UUID for a dev recipe. The dataset carries its own ids so
 * ./apply.ts can delete exactly what it created last time, by id — matching on
 * the slug would risk deleting a hand-written recipe that happened to share a
 * name. Shaped as a v4 UUID so it passes the same validation as a real one.
 */
function devId(rng: Random): string {
  const hex = (n: number) => Array.from({ length: n }, () => "0123456789abcdef"[rng.int(0, 15)]).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${"89ab"[rng.int(0, 3)]}${hex(3)}-${hex(12)}`;
}

/** A deterministic hue for the placeholder image, from the recipe name. */
function hueFor(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return hash % 360;
}

/**
 * The whole dev dataset, in insertion order. Deterministic for a given seed.
 *
 * Names are de-duplicated: the repository derives the slug from the name, and
 * ./apply.ts removes previous dev recipes by slug, so two recipes sharing a
 * name would leave one behind on the next run.
 */
export function generateDevRecipes(seed: string = DEV_SEED, count: number = DEV_RECIPE_COUNT): DevRecipe[] {
  const rng = random(seed);
  const made: DevRecipe[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < count; i += 1) {
    // Walk the shapes in turn, taking the next headline from each shape's own
    // list, so every name is a pairing someone would actually cook.
    const shape = SHAPES[i % SHAPES.length]!;
    const round = Math.floor(i / SHAPES.length);
    const headline = shape.headlines[round % shape.headlines.length]!;
    let name = shape.pattern.replace("{food}", headline);
    // Names must stay distinct: the repository derives the slug from the name.
    if (usedNames.has(name)) name = `${name} (${rng.pick(["Quick", "Weekend", "Family", "Spiced", "Simple"])})`;
    if (usedNames.has(name)) name = `${name} ${i}`;
    usedNames.add(name);

    // A deliberately long name, to test truncation on the cards and the header.
    const longName = i === 3;
    const finalName = longName
      ? `${name} with Charred Corn, Pickled Onion and a Whipped Fetta That Is Frankly the Best Part`
      : name;

    const pantry = rng.shuffle(FOODS);
    const partCount = shape.parts.length;

    // Deliberate outliers: one single-ingredient recipe, one very long one.
    const perPart = i === 5 ? 1 : i === 8 ? 14 : rng.int(3, 8);

    let cursor = 0;
    const parts = shape.parts.map((partName) => {
      const foods = pantry.slice(cursor, cursor + perPart);
      cursor += perPart;
      const ingredients: LinkableIngredient[] = foods.map((entry) => ingredient(rng, entry));
      // One recipe in six has a verbatim line the parser never touched.
      if (rng.chance(0.16)) ingredients.push(rawIngredient(rng, "a good splash of whatever wine is open"));

      const pool = foods.length > 0 ? foods : pantry;
      const steps: LinkableStep[] = Array.from({ length: partCount === 1 ? rng.int(4, 8) : rng.int(2, 4) }, () => ({
        id: devId(rng),
        text: stepText(rng, pool),
        ingredientIds: [],
      }));
      // One step per part plainly names two of its own rows, so the deck
      // always deals a step card with two links; `suggestLinks` below fills
      // in the rest of the matches and leaves the rows no step named alone,
      // so the per-part ingredients card keeps something to show too.
      if (foods.length >= 2) {
        const index = rng.int(0, steps.length - 1);
        steps[index] = { ...steps[index]!, text: doubleStepText(rng, foods) };
      }

      return { name: partName, ingredients, steps: suggestLinks({ ingredients, steps }) };
    });

    const rated = i % 7 !== 0; // one in seven unrated
    const everMade = i % 5 !== 0; // one in five never made
    const hasImage = i % 4 !== 0; // one in four with no image

    // Created dates fan out over two years; updated is at or after created.
    const createdDaysAgo = 730 - i * 14;
    const updatedDaysAgo = rng.chance(0.5) ? createdDaysAgo : Math.max(0, createdDaysAgo - rng.int(1, 200));

    const timeline: TimelineEventInput[] = everMade
      ? Array.from({ length: rng.int(1, 3) }, (_, e) => ({
          occurredOn: dateBefore(Math.max(0, createdDaysAgo - 30 - e * rng.int(20, 120))),
          message: rng.pick([
            "Made this for Sunday lunch. Doubled the garlic, no regrets.",
            "Halved it for two and it worked fine.",
            "Bit salty — go easy on the stock next time.",
            "The kids actually ate it. Repeat.",
            "Ran out of time and skipped the resting step; still good.",
            "",
          ]),
          image: null,
          servings: null,
        }))
      : [];

    made.push({
      input: {
        id: devId(rng),
        name: finalName,
        description: DESCRIPTIONS[i % DESCRIPTIONS.length]!,
        image: null, // set by ./apply.ts once the file is written
        rating: rated ? rng.int(2, 5) : null,
        lastMade: null, // derived from the timeline events
        recipeServings: shape.servings,
        recipeYieldQuantity: shape.servings,
        yieldUnit: null,
        recipeYield: shape.yieldUnit,
        prepTime: rng.pick([5, 10, 15, 20, 30, 45]),
        performTime: rng.pick([10, 15, 20, 30, 45, 60, 90, 120]),
        sourceUrl: rng.chance(0.4) ? rng.pick(SOURCES) : null,
        favourite: rng.chance(0.2),
        notes: rng.chance(0.5) ? rng.sample(NOTES, rng.int(1, 2)).map((n) => ({ ...n })) : [],
        tags: pickTags(rng, shape.tags),
        parts,
      },
      createdAt: daysBefore(createdDaysAgo),
      updatedAt: daysBefore(updatedDaysAgo),
      timeline,
      imageHue: hasImage ? hueFor(finalName) : null,
    });
  }

  return made;
}

/** The ids the dataset owns. ./apply.ts removes exactly these before re-creating. */
export function devIds(recipes: readonly DevRecipe[]): string[] {
  return recipes.map((r) => r.input.id!);
}
