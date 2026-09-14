// Recipe server functions against a temp DATA_DIR: one test per function,
// validation failures, not-found mapping, and servings scaling.
import { isNotFound } from "@tanstack/react-router";
import { describe, expect, test } from "vitest";
import { recipeSchema, recipeSummarySchema, type RecipeInput } from "../../../src/domain/recipe/recipe";
import type { NotFoundData } from "../../../src/server/core/fn";
import {
  createRecipe,
  deleteRecipe,
  getRecipe,
  listRecipes,
  listSubRecipes,
  recipeByName,
  recipeBySource,
  setFavourite,
  setRating,
  updateRecipe,
} from "../../../src/server/fns/recipes";
import { findOrCreateUnit } from "../../../src/server/fns/units";
import { callServerFn, useTempDataDir } from "../../helpers/server";

useTempDataDir();

/** An id no row has, for the not-found and skipped-id cases. */
const MISSING_ID = "00000000-0000-4000-8000-000000000000";

const ids = {
  flour: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  bayLeaf: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  weeknight: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  missing: "99999999-9999-4999-8999-999999999999",
};

const food = (id: string, name: string) => ({ id, name, pluralName: null, aliases: [], aisle: null, recipeId: null, skipShopping: false });
const weeknight = { id: ids.weeknight, name: "Weeknight", slug: "weeknight" };

/** Two servings: 200 g flour scales, one bay leaf is fixed, salt has no amount. */
function doc(overrides: Partial<RecipeInput> = {}): RecipeInput {
  return {
    name: "Flatbread",
    recipeServings: 2,
    recipeYieldQuantity: 4,
    recipeYield: "4 flatbreads",
    tags: [weeknight],
    parts: [
      {
        name: "",
        ingredients: [
          { quantity: 200, food: food(ids.flour, "flour"), fixed: false },
          { quantity: 1, food: food(ids.bayLeaf, "bay leaf"), fixed: true },
          { quantity: null, note: "salt to taste" },
        ],
        steps: [{ text: "Mix." }, { text: "Cook." }],
      },
    ],
    ...overrides,
  };
}

async function notFoundData(promise: Promise<unknown>): Promise<NotFoundData> {
  const caught = await promise.catch((e: unknown) => e);
  expect(isNotFound(caught)).toBe(true);
  return (caught as { data: NotFoundData }).data;
}

test("createRecipe stores the document and returns it with slug, ids and timestamps", async () => {
  const created = await callServerFn(createRecipe, doc());
  expect(recipeSchema.safeParse(created).success).toBe(true);
  expect(created.slug).toBe("flatbread");
  expect(created.recipeServings).toBe(2);
  expect(created.parts[0]!.ingredients.map((i) => i.quantity)).toEqual([200, 1, null]);
  expect(created.parts[0]!.ingredients[0]!.food?.name).toBe("flour");
  expect(created.parts[0]!.steps.map((s) => s.text)).toEqual(["Mix.", "Cook."]);
  expect(created.tags.map((t) => t.slug)).toEqual(["weeknight"]);
});

test("createRecipe rejects an invalid document before touching the database", async () => {
  await expect(callServerFn(createRecipe, doc({ name: "" }))).rejects.toThrow(/too_small|at least 1/);
  await expect(callServerFn(createRecipe, doc({ parts: [] }))).rejects.toThrow(/at least one part/);
  await expect(callServerFn(createRecipe, { ...doc(), recipeServings: -1 })).rejects.toThrow(/too_small|>=0/);
  await expect(callServerFn(listRecipes, {})).resolves.toEqual([]);
});

test("listRecipes returns summaries newest first and filters by name and tag", async () => {
  await callServerFn(createRecipe, doc({ name: "Flatbread" }));
  await callServerFn(createRecipe, doc({ name: "Pancakes", tags: [] }));

  const all = await callServerFn(listRecipes, {});
  expect(all.map((r) => r.name)).toEqual(["Pancakes", "Flatbread"]);
  expect(all.every((r) => recipeSummarySchema.safeParse(r).success)).toBe(true);
  expect(all[0]).not.toHaveProperty("parts");

  expect((await callServerFn(listRecipes, { q: "flat" })).map((r) => r.slug)).toEqual(["flatbread"]);
  expect((await callServerFn(listRecipes, { tag: "weeknight" })).map((r) => r.slug)).toEqual(["flatbread"]);
  expect(await callServerFn(listRecipes, { q: "pan", tag: "weeknight" })).toEqual([]);
});

test("listRecipes filters by tags[] with match, foods[] and favourite", async () => {
  const flat = await callServerFn(createRecipe, doc({ name: "Flatbread", favourite: true }));
  // A distinct food (doc()'s default ingredients would otherwise resolve to the same "flour" row by name).
  await callServerFn(
    createRecipe,
    doc({ name: "Pancakes", tags: [], parts: [{ name: "", ingredients: [{ quantity: 2, food: food(ids.missing, "maple syrup") }], steps: [{ text: "Stack." }] }] }),
  );

  expect((await callServerFn(listRecipes, { tags: ["weeknight"] })).map((r) => r.slug)).toEqual(["flatbread"]);
  expect((await callServerFn(listRecipes, { tags: ["weeknight"], match: "all" })).map((r) => r.slug)).toEqual(["flatbread"]);
  expect((await callServerFn(listRecipes, { foods: [flat.parts[0]!.ingredients[0]!.food!.id] })).map((r) => r.slug)).toEqual(["flatbread"]);
  expect((await callServerFn(listRecipes, { favourite: true })).map((r) => r.slug)).toEqual(["flatbread"]);
  await expect(callServerFn(listRecipes, { foods: ["not-a-uuid"] })).rejects.toThrow(/uuid/i);
});

test("listRecipes sorts and shuffles per sort/dir/seed (M12.4)", async () => {
  await callServerFn(createRecipe, doc({ name: "Flatbread" }));
  await callServerFn(createRecipe, doc({ name: "Pancakes", tags: [] }));

  expect((await callServerFn(listRecipes, { sort: "name", dir: "asc" })).map((r) => r.name)).toEqual(["Flatbread", "Pancakes"]);
  expect((await callServerFn(listRecipes, { sort: "name", dir: "desc" })).map((r) => r.name)).toEqual(["Pancakes", "Flatbread"]);

  const seeded = await callServerFn(listRecipes, { sort: "random", seed: "a" });
  expect(seeded.map((r) => r.name).sort()).toEqual(["Flatbread", "Pancakes"]);
  await expect(callServerFn(listRecipes, { sort: "random", seed: "a" })).resolves.toEqual(seeded);
});

test("getRecipe returns the stored document by slug and maps a miss to notFound", async () => {
  const created = await callServerFn(createRecipe, doc());
  await expect(callServerFn(getRecipe, { slug: "flatbread" })).resolves.toEqual(created);

  const data = await notFoundData(callServerFn(getRecipe, { slug: "nope" }));
  expect(data).toEqual({ entity: "recipe", id: "nope", message: "recipe nope not found" });
  await expect(callServerFn(getRecipe, { slug: "" })).rejects.toThrow(/too_small|at least 1/);
});

test("getRecipe with servings scales linear quantities and yield, leaves fixed and null alone", async () => {
  await callServerFn(createRecipe, doc());
  const scaled = await callServerFn(getRecipe, { slug: "flatbread", servings: 4 });
  expect(scaled.recipeServings).toBe(4);
  expect(scaled.recipeYieldQuantity).toBe(8);
  expect(scaled.parts[0]!.ingredients.map((i) => i.quantity)).toEqual([400, 1, null]);

  // Scaling is a view: the stored recipe is unchanged.
  const stored = await callServerFn(getRecipe, { slug: "flatbread" });
  expect(stored.recipeServings).toBe(2);
  expect(stored.parts[0]!.ingredients.map((i) => i.quantity)).toEqual([200, 1, null]);

  await expect(callServerFn(getRecipe, { slug: "flatbread", servings: 0 })).rejects.toThrow(/too_small|>0/);
});

test("getRecipe with servings returns a recipe with 0 servings unscaled", async () => {
  await callServerFn(createRecipe, doc({ recipeServings: 0 }));
  const out = await callServerFn(getRecipe, { slug: "flatbread", servings: 6 });
  expect(out.recipeServings).toBe(0);
  expect(out.parts[0]!.ingredients.map((i) => i.quantity)).toEqual([200, 1, null]);
});

test("updateRecipe replaces the document, keeps the id, and maps an unknown id to notFound", async () => {
  const created = await callServerFn(createRecipe, doc());
  const updated = await callServerFn(updateRecipe, {
    id: created.id,
    doc: doc({ name: "Garlic Flatbread", recipeServings: 3, parts: [{ name: "Dough", ingredients: [{ quantity: 300, food: food(ids.flour, "flour") }] }] }),
  });
  expect(updated.id).toBe(created.id);
  expect(updated.slug).toBe("garlic-flatbread");
  expect(updated.createdAt).toBe(created.createdAt);
  expect(updated.recipeServings).toBe(3);
  expect(updated.parts.map((c) => c.name)).toEqual(["Dough"]);
  expect(updated.parts[0]!.ingredients.map((i) => i.quantity)).toEqual([300]);
  await expect(callServerFn(getRecipe, { slug: "garlic-flatbread" })).resolves.toEqual(updated);

  const data = await notFoundData(callServerFn(updateRecipe, { id: ids.missing, doc: doc() }));
  expect(data.entity).toBe("recipe");
  expect(data.id).toBe(ids.missing);
  await expect(callServerFn(updateRecipe, { id: "not-a-uuid", doc: doc() })).rejects.toThrow(/uuid/i);
});

test("setFavourite flips the flag and round-trips through listRecipes; an unknown id maps to notFound", async () => {
  const created = await callServerFn(createRecipe, doc());
  expect((await callServerFn(listRecipes, {}))[0]!.favourite).toBe(false);

  await expect(callServerFn(setFavourite, { id: created.id, favourite: true })).resolves.toEqual({ id: created.id, favourite: true });
  expect((await callServerFn(listRecipes, {}))[0]!.favourite).toBe(true);

  await expect(callServerFn(setFavourite, { id: created.id, favourite: false })).resolves.toEqual({ id: created.id, favourite: false });
  expect((await callServerFn(listRecipes, {}))[0]!.favourite).toBe(false);

  const data = await notFoundData(callServerFn(setFavourite, { id: ids.missing, favourite: true }));
  expect(data).toEqual({ entity: "recipe", id: ids.missing, message: `recipe ${ids.missing} not found` });
});

describe("setRating (M25.3)", () => {
  test("stores a rating from 1 to 5 and shows it on the document and the summary", async () => {
    const created = await callServerFn(createRecipe, doc());
    expect(created.rating).toBeNull();

    await expect(callServerFn(setRating, { id: created.id, rating: 4 })).resolves.toEqual({ id: created.id, rating: 4 });
    expect((await callServerFn(getRecipe, { slug: created.slug })).rating).toBe(4);
    expect((await callServerFn(listRecipes, {}))[0]!.rating).toBe(4);

    await expect(callServerFn(setRating, { id: created.id, rating: 5 })).resolves.toEqual({ id: created.id, rating: 5 });
    expect((await callServerFn(getRecipe, { slug: created.slug })).rating).toBe(5);
  });

  test("zero clears the rating back to null", async () => {
    const created = await callServerFn(createRecipe, doc());
    await callServerFn(setRating, { id: created.id, rating: 3 });

    await expect(callServerFn(setRating, { id: created.id, rating: 0 })).resolves.toEqual({ id: created.id, rating: null });
    expect((await callServerFn(getRecipe, { slug: created.slug })).rating).toBeNull();
  });

  test("rejects a rating outside 0 to 5, and an unknown id maps to notFound", async () => {
    const created = await callServerFn(createRecipe, doc());
    await expect(callServerFn(setRating, { id: created.id, rating: 6 })).rejects.toThrow();
    await expect(callServerFn(setRating, { id: created.id, rating: -1 })).rejects.toThrow();
    expect((await callServerFn(getRecipe, { slug: created.slug })).rating).toBeNull();

    const data = await notFoundData(callServerFn(setRating, { id: ids.missing, rating: 3 }));
    expect(data).toEqual({ entity: "recipe", id: ids.missing, message: `recipe ${ids.missing} not found` });
  });
});

test("deleteRecipe removes the recipe, returns it, and maps an unknown id to notFound", async () => {
  const created = await callServerFn(createRecipe, doc());
  await expect(callServerFn(deleteRecipe, { id: created.id })).resolves.toEqual(created);
  expect(await callServerFn(listRecipes, {})).toEqual([]);
  await notFoundData(callServerFn(getRecipe, { slug: "flatbread" }));

  const data = await notFoundData(callServerFn(deleteRecipe, { id: created.id }));
  expect(data).toEqual({ entity: "recipe", id: created.id, message: `recipe ${created.id} not found` });
});

describe("recipeBySource (M23.7)", () => {
  test("finds a recipe already imported from the same address, and nothing else", async () => {
    const url = "https://example.test/anzac-biscuits";
    await callServerFn(createRecipe, { name: "Anzac biscuits", sourceUrl: url, parts: [{ name: "", ingredients: [], steps: [] }] });
    await callServerFn(createRecipe, { name: "Pancakes", parts: [{ name: "", ingredients: [], steps: [] }] });

    expect(await callServerFn(recipeBySource, { sourceUrl: url })).toEqual({ name: "Anzac biscuits", slug: "anzac-biscuits" });
    // Whitespace around the pasted address does not change the answer.
    expect(await callServerFn(recipeBySource, { sourceUrl: `  ${url} ` })).toMatchObject({ slug: "anzac-biscuits" });
    // A different address, and a recipe with no source at all, are not matches.
    expect(await callServerFn(recipeBySource, { sourceUrl: "https://example.test/other" })).toBeNull();
    expect(await callServerFn(recipeBySource, { sourceUrl: `${url}?utm_source=x` })).toBeNull();
  });
});

describe("recipeByName (M34.3)", () => {
  test("finds a recipe already here under that name, whatever the case", async () => {
    await callServerFn(createRecipe, { name: "Lemon tart", parts: [{ name: "", ingredients: [], steps: [] }] });

    expect(await callServerFn(recipeByName, { name: "Lemon tart" })).toEqual({ name: "Lemon tart", slug: "lemon-tart" });
    expect(await callServerFn(recipeByName, { name: "  lemon TART " })).toMatchObject({ slug: "lemon-tart" });
    expect(await callServerFn(recipeByName, { name: "Lemon tarts" })).toBeNull();
  });
});

test("listSubRecipes returns the slug and yield of each id, skipping unknown ones", async () => {
  const gram = await callServerFn(findOrCreateUnit, { name: "gram" });
  const pastry = await callServerFn(createRecipe, {
    name: "Sweet pastry",
    recipeServings: 4,
    recipeYieldQuantity: 500,
    yieldUnit: gram,
    parts: [{ name: "" }],
  } as unknown as RecipeInput);
  const sauce = await callServerFn(createRecipe, { name: "Hollandaise", parts: [{ name: "" }] } as unknown as RecipeInput);

  const children = await callServerFn(listSubRecipes, { ids: [pastry.id, sauce.id, MISSING_ID] });
  expect(children.map((child) => child.name)).toEqual(["Hollandaise", "Sweet pastry"]);
  expect(children.find((child) => child.id === pastry.id)).toEqual({
    id: pastry.id,
    slug: "sweet-pastry",
    name: "Sweet pastry",
    recipeServings: 4,
    recipeYieldQuantity: 500,
    yieldUnit: expect.objectContaining({ id: gram.id, name: "gram" }),
  });
  expect(children.find((child) => child.id === sauce.id)?.yieldUnit).toBeNull();
});

test("listSubRecipes with no ids asks for nothing, and de-duplicates the ones it gets", async () => {
  const pastry = await callServerFn(createRecipe, { name: "Shortcrust", parts: [{ name: "" }] } as unknown as RecipeInput);
  expect(await callServerFn(listSubRecipes, { ids: [] })).toEqual([]);
  expect(await callServerFn(listSubRecipes, { ids: [pastry.id, pastry.id] })).toHaveLength(1);
});
