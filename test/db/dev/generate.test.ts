// The dev dataset: deterministic, valid, and covering the awkward cases the
// list, filter and sort screens need to render.
import { expect, test } from "vitest";
import { DEV_RECIPE_COUNT, devIds, generateDevRecipes } from "../../../src/db/dev/generate";
import { hslToRgb, placeholderPng } from "../../../src/db/dev/png";
import { random, seedFrom } from "../../../src/db/dev/random";
import { slugify } from "../../../src/domain/names";
import { recipeInputSchema } from "../../../src/domain/recipe/recipe";

test("the same seed produces byte-identical data, a different seed does not", () => {
  expect(generateDevRecipes()).toEqual(generateDevRecipes());
  expect(generateDevRecipes("other-seed")).not.toEqual(generateDevRecipes());
});

test("every document is valid RecipeInput", () => {
  for (const item of generateDevRecipes()) {
    expect(() => recipeInputSchema.parse(item.input)).not.toThrow();
  }
});

test("the default run is fifteen recipes with distinct names, slugs and ids", () => {
  const dataset = generateDevRecipes();
  expect(dataset).toHaveLength(DEV_RECIPE_COUNT);
  expect(new Set(dataset.map((r) => r.input.name)).size).toBe(DEV_RECIPE_COUNT);
  expect(new Set(dataset.map((r) => slugify(r.input.name))).size).toBe(DEV_RECIPE_COUNT);
  expect(new Set(devIds(dataset)).size).toBe(DEV_RECIPE_COUNT);
});

test("ids are v4-shaped, so they pass the same validation as a real one", () => {
  for (const id of devIds(generateDevRecipes())) {
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  }
});

test("the mix covers the cases the screens have to handle", () => {
  // Against the parsed documents: RecipeInput is the pre-parse type, where
  // every defaulted field is still optional.
  const dataset = generateDevRecipes().map((r) => ({ ...r, input: recipeInputSchema.parse(r.input) }));
  const has = (predicate: (r: (typeof dataset)[number]) => boolean) => dataset.some(predicate);

  expect(has((r) => r.input.parts.length === 1 && r.input.parts[0]!.name === "")).toBe(true); // flat
  expect(has((r) => r.input.parts.length > 1)).toBe(true); // named components
  expect(has((r) => r.input.rating === null)).toBe(true); // unrated
  expect(has((r) => r.input.rating !== null)).toBe(true);
  expect(has((r) => r.timeline.length === 0)).toBe(true); // never made
  expect(has((r) => r.timeline.length > 0)).toBe(true);
  expect(has((r) => r.imageHue === null)).toBe(true); // no image
  expect(has((r) => r.imageHue !== null)).toBe(true);
  expect(has((r) => r.input.favourite)).toBe(true);
  expect(has((r) => !r.input.favourite)).toBe(true);
  expect(has((r) => r.input.sourceUrl !== null)).toBe(true);
  expect(has((r) => r.input.notes.length > 0)).toBe(true);
  expect(has((r) => r.input.name.length > 60)).toBe(true); // truncation
  expect(has((r) => r.input.parts.some((c) => c.ingredients.length === 1))).toBe(true);
  expect(has((r) => r.input.parts.some((c) => c.ingredients.length >= 14))).toBe(true);
  // A verbatim line the parser never touched, and a line with no amount.
  expect(has((r) => r.input.parts.some((c) => c.ingredients.some((i) => i.food == null && i.originalText !== "")))).toBe(true);
  expect(has((r) => r.input.parts.some((c) => c.ingredients.some((i) => i.quantity == null && i.food != null)))).toBe(true);
  expect(has((r) => r.input.parts.some((c) => c.ingredients.some((i) => i.fixed)))).toBe(true);
});

test("steps link the rows their text names, some doubly, and a fraction of rows stay unlinked", () => {
  const dataset = generateDevRecipes().map((r) => recipeInputSchema.parse(r.input));
  const parts = dataset.flatMap((r) => r.parts);
  const steps = parts.flatMap((p) => p.steps);

  expect(steps.some((s) => s.ingredientIds.length >= 2)).toBe(true);
  expect(steps.some((s) => s.ingredientIds.length === 0)).toBe(true);

  // Every link names a row within its own part.
  for (const part of parts) {
    const ids = new Set(part.ingredients.map((line) => line.id));
    for (const step of part.steps) for (const ingredientId of step.ingredientIds) expect(ids.has(ingredientId)).toBe(true);
  }

  // A fraction of rows are named by no step at all, so the per-part
  // ingredients card still has something to show.
  const linkedIds = new Set(steps.flatMap((s) => s.ingredientIds));
  const allIds = parts.flatMap((p) => p.ingredients.map((line) => line.id!));
  expect(allIds.some((id) => !linkedIds.has(id))).toBe(true);
});

test("created and updated fan out, and updated is never before created", () => {
  const dataset = generateDevRecipes();
  const created = dataset.map((r) => r.createdAt);
  expect(new Set(created).size).toBeGreaterThan(DEV_RECIPE_COUNT / 2);
  for (const item of dataset) {
    expect(item.updatedAt >= item.createdAt).toBe(true);
  }
});

test("tags are uneven: some on many recipes, some on few", () => {
  const counts = new Map<string, number>();
  for (const item of generateDevRecipes()) {
    for (const tag of recipeInputSchema.parse(item.input).tags) counts.set(tag.name, (counts.get(tag.name) ?? 0) + 1);
  }
  const used = [...counts.values()].sort((a, b) => b - a);
  expect(counts.size).toBeGreaterThan(5);
  expect(used[0]!).toBeGreaterThan(5);
  expect(used.at(-1)!).toBeLessThanOrEqual(3);
});

test("--count is honoured and stays a prefix of the full set", () => {
  const ten = generateDevRecipes(undefined, 10);
  expect(ten).toHaveLength(10);
  expect(ten).toEqual(generateDevRecipes().slice(0, 10));
});

test("the PRNG is stable and seedFrom is order-sensitive", () => {
  expect(Array.from({ length: 5 }, () => random("abc").next())).toEqual(Array.from({ length: 5 }, () => random("abc").next()));
  expect(seedFrom("abc")).not.toBe(seedFrom("cba"));
  const rng = random(1);
  for (let i = 0; i < 200; i += 1) {
    const n = rng.int(3, 7);
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(7);
  }
  expect(random("x").sample([1, 2, 3], 9)).toHaveLength(3);
  expect(random("x").shuffle([1, 2, 3]).sort()).toEqual([1, 2, 3]);
});

test("the placeholder is a real PNG the image sniffer will accept", () => {
  const png = placeholderPng(210, 32, 24);
  expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // IHDR carries the dimensions we asked for.
  const view = new DataView(png.buffer, png.byteOffset);
  expect(view.getUint32(16)).toBe(32);
  expect(view.getUint32(20)).toBe(24);
  // IEND closes it.
  expect(new TextDecoder().decode(png.subarray(-8, -4))).toBe("IEND");
  expect(placeholderPng(210, 32, 24)).toEqual(png);
});

test("hslToRgb covers each sixth of the wheel and clamps to bytes", () => {
  for (const h of [0, 45, 90, 150, 210, 270, 330, 400, -30]) {
    const { r, g, b } = hslToRgb(h, 0.5, 0.45);
    for (const channel of [r, g, b]) {
      expect(Number.isInteger(channel)).toBe(true);
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(255);
    }
  }
  expect(hslToRgb(0, 0, 0)).toEqual({ r: 0, g: 0, b: 0 });
  expect(hslToRgb(0, 0, 1)).toEqual({ r: 255, g: 255, b: 255 });
});
