// toCooklang (M34.2): unit tests over the building blocks, a golden-file test
// over the three sample recipes, and a property test that every ingredient a
// step links comes out somewhere as an `@` reference, whatever text and
// quantities it is given.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { openDatabase } from "../../src/db/connection/open";
import { migrate } from "../../src/db/migrations/migrate";
import { recipes } from "../../src/db/models/recipe/repo";
import { seedSample } from "../../src/db/seed/seed";
import { cooklangStepText, toCooklang } from "../../src/domain/cooklang";
import type { Food, Ingredient, Recipe, Unit } from "../../src/domain/recipe";

const FIXTURES = join(import.meta.dirname, "..", "fixtures", "cooklang");

function unit(name: string, over: Partial<Unit> = {}): Unit {
  return {
    id: "u",
    name,
    pluralName: null,
    abbreviation: "",
    useAbbreviation: false,
    fraction: true,
    standardQuantity: null,
    standardUnitId: null,
    ...over,
  };
}

function food(name: string, over: Partial<Food> = {}): Food {
  return { id: "f", name, pluralName: null, aliases: [], aisle: null, recipeId: null, skipShopping: false, conversions: [], ...over };
}

function ingredient(id: string, over: Partial<Ingredient> = {}): Ingredient {
  return { id, quantity: null, unit: null, food: null, note: "", originalText: "", fixed: false, ...over };
}

describe("cooklangStepText", () => {
  test("a linked ingredient named in the text becomes an inline @ reference", () => {
    const flour = ingredient("i1", { quantity: 200, unit: unit("gram", { abbreviation: "g", useAbbreviation: true }), food: food("flour") });
    const text = cooklangStepText({ text: "Sift the flour.", ingredientIds: ["i1"] }, new Map([["i1", flour]]));
    expect(text).toBe("Sift the @flour{200%g}.");
  });

  test("a multi-word food gets braces even with no quantity", () => {
    const salt = ingredient("i1", { food: food("sea salt") });
    const text = cooklangStepText({ text: "Season with sea salt.", ingredientIds: ["i1"] }, new Map([["i1", salt]]));
    expect(text).toBe("Season with @sea salt{}.");
  });

  test("a single-word food with no quantity needs no braces", () => {
    const salt = ingredient("i1", { food: food("salt") });
    const text = cooklangStepText({ text: "Season with salt.", ingredientIds: ["i1"] }, new Map([["i1", salt]]));
    expect(text).toBe("Season with @salt.");
  });

  test("a fixed quantity gets the = prefix", () => {
    const bayLeaf = ingredient("i1", { quantity: 1, fixed: true, food: food("bay leaf") });
    const text = cooklangStepText({ text: "Add the bay leaf.", ingredientIds: ["i1"] }, new Map([["i1", bayLeaf]]));
    expect(text).toBe("Add the @bay leaf{=1}.");
  });

  test("a linked ingredient not named in the text is appended, not dropped", () => {
    const cream = ingredient("i1", { quantity: 100, unit: unit("millilitre", { abbreviation: "ml", useAbbreviation: true }), food: food("thickened cream") });
    const text = cooklangStepText({ text: "Whisk until smooth.", ingredientIds: ["i1"] }, new Map([["i1", cream]]));
    expect(text).toBe("Whisk until smooth. @thickened cream{100%ml}");
  });

  test("a linked row with no food (a text-only ingredient) is left as plain text", () => {
    const zest = ingredient("i1", { food: null, originalText: "Zest of a lemon" });
    const text = cooklangStepText({ text: "Add the zest.", ingredientIds: ["i1"] }, new Map([["i1", zest]]));
    expect(text).toBe("Add the zest.");
  });

  test("an unlinked ingredient in the part is never referenced", () => {
    const flour = ingredient("i1", { quantity: 1, unit: unit("cup"), food: food("flour") });
    const text = cooklangStepText({ text: "Sift the flour.", ingredientIds: [] }, new Map([["i1", flour]]));
    expect(text).toBe("Sift the flour.");
  });

  test("a duration in the text becomes a timer", () => {
    const text = cooklangStepText({ text: "Bake for 20 minutes.", ingredientIds: [] }, new Map());
    expect(text).toBe("Bake for ~{20%minutes}.");
  });

  test("an hour-long duration reads in hours, a plain-seconds one in seconds", () => {
    expect(cooklangStepText({ text: "Prove for 1 hour.", ingredientIds: [] }, new Map())).toBe("Prove for ~{1%hours}.");
    expect(cooklangStepText({ text: "Blitz for 45 seconds.", ingredientIds: [] }, new Map())).toBe("Blitz for ~{45%seconds}.");
  });

  test("an ingredient and a timer in the same step both convert", () => {
    const stock = ingredient("i1", { quantity: 1, unit: unit("litre", { abbreviation: "l", useAbbreviation: true }), food: food("stock") });
    const text = cooklangStepText({ text: "Simmer the stock for 10 minutes.", ingredientIds: ["i1"] }, new Map([["i1", stock]]));
    expect(text).toBe("Simmer the @stock{1%l} for ~{10%minutes}.");
  });
});

describe("toCooklang", () => {
  const base: Recipe = {
    id: "r1",
    slug: "test-recipe",
    name: "Test recipe",
    description: "",
    image: null,
    rating: null,
    lastMade: null,
    favourite: false,
    recipeServings: 4,
    recipeYieldQuantity: 0,
    yieldUnit: null,
    recipeYield: "",
    prepTime: null,
    performTime: null,
    sourceUrl: null,
    notes: [],
    tags: [],
    parts: [{ id: "p1", name: "", ingredients: [], steps: [{ id: "s1", text: "Mix it.", ingredientIds: [], image: null }] }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  test("the metadata block carries servings, source and tags, only when present", () => {
    expect(toCooklang(base)).toBe(">> servings: 4\n\nMix it.\n");
    expect(toCooklang({ ...base, recipeServings: 0 })).toBe("Mix it.\n");
    expect(toCooklang({ ...base, sourceUrl: "https://example.com/x" })).toBe(">> servings: 4\n>> source: https://example.com/x\n\nMix it.\n");
    expect(toCooklang({ ...base, tags: [{ id: "t1", name: "Baking", slug: "baking" }, { id: "t2", name: "Dessert", slug: "dessert" }] })).toBe(
      ">> servings: 4\n>> tags: Baking, Dessert\n\nMix it.\n",
    );
  });

  test("a named part gets an == heading ==, the unnamed part does not", () => {
    const doc: Recipe = {
      ...base,
      parts: [
        { id: "p1", name: "Pastry", ingredients: [], steps: [{ id: "s1", text: "Rub it together.", ingredientIds: [], image: null }] },
        { id: "p2", name: "", ingredients: [], steps: [{ id: "s2", text: "Serve.", ingredientIds: [], image: null }] },
      ],
    };
    expect(toCooklang(doc)).toBe(">> servings: 4\n\n== Pastry ==\n\nRub it together.\n\nServe.\n");
  });

  test("a part with no steps contributes nothing", () => {
    const doc: Recipe = { ...base, parts: [...base.parts, { id: "p2", name: "Empty", ingredients: [], steps: [] }] };
    expect(toCooklang(doc)).toBe(toCooklang(base));
  });
});

describe("golden files: the three sample recipes", () => {
  test.each([
    ["anzac-biscuits"],
    ["roast-pumpkin-soup-with-garlic-croutons"],
    ["lemon-tart"],
  ])("%s matches its fixture", async (slug) => {
    const db = openDatabase(":memory:");
    await migrate(db);
    seedSample(db);
    const doc = recipes(db).get(slug)!;
    const expected = readFileSync(join(FIXTURES, `${slug}.cook`), "utf8");
    expect(toCooklang(doc)).toBe(expected);
    db.close();
  });
});

// --- Property test: every linked food is an @ reference, whatever it is given ---

/** A small seeded PRNG (mulberry32), so a failure is reproducible without a new dependency. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FOOD_NAMES = ["egg", "flour", "olive oil", "sea salt", "brown sugar", "thickened cream", "bay leaf", "garlic", "milk"];
const UNIT_NAMES = [null, "gram", "cup", "tablespoon", "clove", "millilitre"];
const WORDS = ["Mix", "the", "stir", "well", "and", "add", "to", "a", "bowl", "then", "rest", "for", "10", "minutes", "gently", "fold"];

function randomInt(rng: () => number, max: number): number {
  return Math.floor(rng() * max);
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[randomInt(rng, items.length)]!;
}

function randomIngredient(rng: () => number, id: string): Ingredient {
  const hasFood = rng() > 0.15;
  const unitName = pick(rng, UNIT_NAMES);
  return ingredient(id, {
    quantity: rng() > 0.2 ? Math.round(rng() * 1000) / 10 : null,
    unit: unitName ? unit(unitName, { useAbbreviation: rng() > 0.5 }) : null,
    fixed: rng() > 0.7,
    food: hasFood ? food(pick(rng, FOOD_NAMES)) : null,
  });
}

function randomText(rng: () => number): string {
  const length = 3 + randomInt(rng, 8);
  return Array.from({ length }, () => pick(rng, WORDS)).join(" ") + ".";
}

test("every linked food comes out as an @ reference, over many random steps", () => {
  const rng = mulberry32(20260913);

  for (let trial = 0; trial < 200; trial += 1) {
    const rowCount = 1 + randomInt(rng, 4);
    const ingredients = new Map<string, Ingredient>();
    for (let i = 0; i < rowCount; i += 1) ingredients.set(`row-${i}`, randomIngredient(rng, `row-${i}`));

    const linkedCount = randomInt(rng, rowCount + 1);
    const ids = [...ingredients.keys()];
    // Shuffle (Fisher-Yates) then take a prefix, so link order also varies.
    for (let i = ids.length - 1; i > 0; i -= 1) {
      const j = randomInt(rng, i + 1);
      [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    }
    const linked = ids.slice(0, linkedCount);

    const text = randomText(rng);
    const result = cooklangStepText({ text, ingredientIds: linked }, ingredients);

    for (const id of linked) {
      const row = ingredients.get(id)!;
      if (row.food === null) continue;
      expect(result, `trial ${trial}: "${row.food.name}" linked in "${text}" -> "${result}"`).toContain(`@${row.food.name}`);
    }
  }
});
