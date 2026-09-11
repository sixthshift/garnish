// Sample recipes: three documents through the repository, idempotent by slug,
// and visible through the listRecipes server function.
import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { migrate, openDatabase } from "../../src/db/migrate";
import { recipes } from "../../src/db/recipes";
import { SAMPLE_RECIPES, seedSample } from "../../src/db/sample";
import { DEFAULT_UNITS, parseSeedFlags, seed } from "../../src/db/seed";
import { timeline } from "../../src/db/timeline";
import { recipeInputSchema, recipeSchema } from "../../src/domain/recipe";
import { listRecipes } from "../../src/server/recipes";
import { getDb } from "../../src/server/db";
import { callServerFn, useTempDataDir } from "../helpers/server";

useTempDataDir();

let db: Database;
beforeEach(async () => {
  db = openDatabase(":memory:");
  await migrate(db);
  seed(db);
});

const count = (table: string) => db.query<{ n: number }, []>(`SELECT count(*) AS n FROM ${table}`).get()!.n;

test("the sample documents are valid RecipeInput and have distinct names", () => {
  expect(SAMPLE_RECIPES).toHaveLength(3);
  for (const doc of SAMPLE_RECIPES) expect(recipeInputSchema.safeParse(doc).success).toBe(true);
  expect(new Set(SAMPLE_RECIPES.map((r) => r.name)).size).toBe(3);
  expect(SAMPLE_RECIPES.map((r) => r.components.length).sort()).toEqual([1, 2, 3]);
  expect(SAMPLE_RECIPES.every((r) => r.image === undefined || r.image === null)).toBe(true);
});

test("seeds three recipes that read back as full documents", () => {
  const { recipes: created } = seedSample(db);
  expect(created).toHaveLength(3);
  expect(count("recipe")).toBe(3);
  for (const doc of created) expect(recipeSchema.safeParse(doc).success).toBe(true);

  const listed = recipes(db).list();
  expect(listed.map((r) => r.name).sort()).toEqual(["Anzac Biscuits", "Lemon Tart", "Roast Pumpkin Soup with Garlic Croutons"]);
  expect(listed.every((r) => r.image === null)).toBe(true);
  expect(listed.some((r) => r.rating !== null)).toBe(true);
  expect(listed.every((r) => r.tags.length > 0)).toBe(true);
});

test("one recipe has three components in order, one has two plus recipe-level steps, one is flat", () => {
  seedSample(db);
  const repo = recipes(db);

  const tart = repo.get("lemon-tart")!;
  expect(tart.components.map((c) => c.name)).toEqual(["Pastry", "Filling", "To finish"]);
  expect(tart.components.every((c) => c.ingredients.length > 0 && c.steps.length > 0)).toBe(true);
  expect(tart.notes.map((n) => n.title)).toEqual(["Blind baking", "Wobble"]);
  expect(tart.recipeServings).toBe(8);
  expect(tart.prepTime).toBe(40);
  expect(tart.performTime).toBe(50);

  const soup = repo.get("roast-pumpkin-soup-with-garlic-croutons")!;
  expect(soup.components.map((c) => c.name)).toEqual(["Soup", "Garlic croutons"]);
  expect(soup.steps).toHaveLength(1);
  expect(soup.yieldUnit?.name).toBe("litre");

  const biscuits = repo.get("anzac-biscuits")!;
  expect(biscuits.components).toHaveLength(1);
  expect(biscuits.components[0]!.name).toBe("");
  expect(biscuits.components[0]!.steps.length).toBeGreaterThan(0);
  expect(biscuits.rating).toBe(5);
});

test("fixed, null-quantity and text-only rows survive the round trip", () => {
  seedSample(db);
  const repo = recipes(db);

  const soupRows = repo.get("roast-pumpkin-soup-with-garlic-croutons")!.components[0]!.ingredients;
  const bayLeaf = soupRows.find((i) => i.food?.name === "bay leaf")!;
  expect(bayLeaf).toMatchObject({ quantity: 1, fixed: true, unit: null });
  const salt = soupRows.find((i) => i.food?.name === "salt")!;
  expect(salt).toMatchObject({ quantity: null, unit: null, note: "to taste", fixed: false });

  const tart = repo.get("lemon-tart")!;
  const textOnly = tart.components.flatMap((c) => c.ingredients).filter((i) => i.food === null);
  expect(textOnly.map((i) => i.originalText)).toEqual(["Finely grated zest of 2 lemons", "Icing sugar, for dusting"]);
  expect(textOnly.every((i) => i.quantity === null && i.unit === null)).toBe(true);
  expect(tart.components[0]!.ingredients.find((i) => i.food?.name === "salt")).toMatchObject({ quantity: 1, fixed: true });
  expect(tart.components[0]!.ingredients.find((i) => i.food?.name === "salt")!.unit?.name).toBe("pinch");
});

test("references resolve to the seeded units and shared foods and tags", () => {
  seedSample(db);
  expect(count("unit")).toBe(DEFAULT_UNITS.length);
  const seededGram = db.query<{ id: string }, []>("SELECT id FROM unit WHERE name = 'gram'").get()!.id;
  const flour = recipes(db).get("anzac-biscuits")!.components[0]!.ingredients.find((i) => i.food?.name === "brown sugar")!;
  expect(flour.unit?.id).toBe(seededGram);

  // "butter" appears in two recipes and "Baking" tags two: one row each.
  expect(db.query<{ n: number }, []>("SELECT count(*) AS n FROM food WHERE name = 'butter'").get()!.n).toBe(1);
  expect(db.query<{ n: number }, []>("SELECT count(*) AS n FROM tag WHERE name = 'Baking'").get()!.n).toBe(1);
  expect(db.query<{ n: number }, []>("SELECT count(*) AS n FROM recipe_tag rt JOIN tag t ON t.id = rt.tag_id WHERE t.slug = 'baking'").get()!.n).toBe(2);
});

test("one recipe is favourited, one carries a source URL, and one has two timeline events", () => {
  seedSample(db);
  const repo = recipes(db);

  const biscuits = repo.get("anzac-biscuits")!;
  expect(biscuits.favourite).toBe(true);
  expect(repo.get("lemon-tart")!.favourite).toBe(false);
  expect(repo.get("roast-pumpkin-soup-with-garlic-croutons")!.favourite).toBe(false);

  const soup = repo.get("roast-pumpkin-soup-with-garlic-croutons")!;
  expect(soup.sourceUrl).toBe("https://www.homegrown-kitchen.example/recipes/roast-pumpkin-soup-with-garlic-croutons");
  expect(biscuits.sourceUrl).toBeNull();

  const tart = repo.get("lemon-tart")!;
  const events = timeline(db).list(tart.id);
  expect(events).toHaveLength(2);
  expect(events.map((e) => e.occurredOn)).toEqual(["2026-09-06", "2026-08-16"]);
  expect(tart.lastMade).toBe("2026-09-06T00:00:00.000Z");
});

test("seeding twice leaves three recipes, two timeline events and no duplicate children", () => {
  seedSample(db);
  expect(count("timeline_event")).toBe(2);
  const before = {
    recipe: count("recipe"),
    component: count("component"),
    ingredient: count("ingredient"),
    step: count("step"),
    food: count("food"),
    tag: count("tag"),
    timeline_event: count("timeline_event"),
  };
  const second = seedSample(db);
  expect(second.recipes).toEqual([]);
  expect(count("recipe")).toBe(3);
  expect({
    recipe: count("recipe"),
    component: count("component"),
    ingredient: count("ingredient"),
    step: count("step"),
    food: count("food"),
    tag: count("tag"),
    timeline_event: count("timeline_event"),
  }).toEqual(before);
});

test("skips only the recipes whose slug exists and does not touch the user's copy", () => {
  const repo = recipes(db);
  const mine = repo.create(recipeInputSchema.parse({ name: "Lemon Tart", components: [{ name: "", ingredients: [], steps: [] }] }));
  const { recipes: created } = seedSample(db);
  expect(created.map((r) => r.slug).sort()).toEqual(["anzac-biscuits", "roast-pumpkin-soup-with-garlic-croutons"]);
  expect(count("recipe")).toBe(3);
  expect(repo.get("lemon-tart")).toEqual(mine);
  expect(timeline(db).list(mine.id)).toEqual([]);
});

test("works without the units seed, creating the units it names", async () => {
  const bare = openDatabase(":memory:");
  await migrate(bare);
  seedSample(bare);
  expect(bare.query<{ n: number }, []>("SELECT count(*) AS n FROM recipe").get()!.n).toBe(3);
  expect(recipes(bare).get("anzac-biscuits")!.components[0]!.ingredients[3]!.unit).toMatchObject({ name: "gram", abbreviation: "g", useAbbreviation: true });
  bare.close();
});

test("listRecipes shows the three sample recipes", async () => {
  seedSample(await getDb());
  const listed = await callServerFn(listRecipes, {});
  expect(listed.map((r) => r.name).sort()).toEqual(["Anzac Biscuits", "Lemon Tart", "Roast Pumpkin Soup with Garlic Croutons"]);
  expect((await callServerFn(listRecipes, { tag: "baking" })).map((r) => r.slug).sort()).toEqual(["anzac-biscuits", "lemon-tart"]);
});

test("parseSeedFlags reads --sample and rejects anything else", () => {
  expect(parseSeedFlags([])).toEqual({ sample: false });
  expect(parseSeedFlags(["--sample"])).toEqual({ sample: true });
  expect(() => parseSeedFlags(["--smaple"])).toThrow(/Unknown argument --smaple/);
});
