// Applying the dev dataset: a replace, not a merge, and it never takes a
// hand-written recipe with it.
import type { Database } from "bun:sqlite";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, expect, test } from "vitest";
import { openDatabase } from "../../../src/db/connection/open";
import { applyDevData } from "../../../src/db/dev/apply";
import { parseDevSeedFlags } from "../../../src/db/dev/cli";
import { devIds, generateDevRecipes } from "../../../src/db/dev/generate";
import { migrate } from "../../../src/db/migrations/migrate";
import { recipes } from "../../../src/db/models/recipe/repo";
import { timeline } from "../../../src/db/models/timeline/repo";
import { seed } from "../../../src/db/seed/seed";
import { recipeInputSchema } from "../../../src/domain/recipe";

let db: Database;
let images: string;

beforeEach(async () => {
  db = openDatabase(":memory:");
  await migrate(db);
  seed(db);
  images = mkdtempSync(join(tmpdir(), "garnish-dev-images-"));
});

/** A small slice, so the tests stay quick; the shape is the same as the full run. */
const small = () => generateDevRecipes(undefined, 6);

test("creates the dataset, its timeline events and its images", async () => {
  const dataset = small();
  const result = await applyDevData(db, dataset, images);

  expect(result).toEqual({ removed: 0, created: 6, images: dataset.filter((r) => r.imageHue !== null).length });
  expect(recipes(db).list()).toHaveLength(6);

  const withEvents = dataset.filter((r) => r.timeline.length > 0);
  expect(withEvents.length).toBeGreaterThan(0);
  for (const item of withEvents) {
    expect(timeline(db).list(item.input.id!)).toHaveLength(item.timeline.length);
  }

  expect(readdirSync(images)).toHaveLength(result.images);
});

test("re-running replaces rather than duplicates, and lands in the same state", async () => {
  const dataset = small();
  await applyDevData(db, dataset, images);
  const first = recipes(db)
    .list()
    .map((r) => `${r.slug}|${r.rating}|${r.favourite}|${r.lastMade}`);

  const second = await applyDevData(db, dataset, images);
  expect(second.removed).toBe(6);
  expect(second.created).toBe(6);
  expect(recipes(db).list()).toHaveLength(6);

  expect(
    recipes(db)
      .list()
      .map((r) => `${r.slug}|${r.rating}|${r.favourite}|${r.lastMade}`)
  ).toEqual(first);
});

test("a hand-written recipe survives a re-run, even sharing a name", async () => {
  const dataset = small();
  await applyDevData(db, dataset, images);

  // Same name as a generated one: the slug collides, the id does not.
  const mine = recipes(db).create(recipeInputSchema.parse({ name: dataset[0]!.input.name, parts: [{ name: "", ingredients: [], steps: [] }] }));

  await applyDevData(db, dataset, images);
  expect(recipes(db).get(mine.slug)).not.toBeNull();
  expect(recipes(db).list()).toHaveLength(7);
});

test("timestamps are the generated ones, not the moment of the insert", async () => {
  const dataset = small();
  await applyDevData(db, dataset, images);
  const rows = db.query<{ id: string; created_at: string; updated_at: string }, []>("SELECT id, created_at, updated_at FROM recipe").all();
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const item of dataset) {
    const row = byId.get(item.input.id!)!;
    expect(row.created_at).toBe(item.createdAt);
    expect(row.updated_at).toBe(item.updatedAt);
  }
});

test("the ids it owns are exactly the ones it removes", async () => {
  const dataset = small();
  await applyDevData(db, dataset, images);
  const stored = new Set(
    db
      .query<{ id: string }, []>("SELECT id FROM recipe")
      .all()
      .map((r) => r.id)
  );
  expect(devIds(dataset).every((id) => stored.has(id))).toBe(true);
});

test("flags parse, and a bad one throws rather than rebuilding with defaults", () => {
  expect(parseDevSeedFlags([])).toEqual({ count: 15, seed: "garnish-dev-data-v1" });
  expect(parseDevSeedFlags(["--count", "12"])).toMatchObject({ count: 12 });
  expect(parseDevSeedFlags(["--seed", "other"])).toMatchObject({ seed: "other" });
  expect(() => parseDevSeedFlags(["--count"])).toThrow(/positive whole number/);
  expect(() => parseDevSeedFlags(["--count", "0"])).toThrow(/positive whole number/);
  expect(() => parseDevSeedFlags(["--seed"])).toThrow(/needs a value/);
  expect(() => parseDevSeedFlags(["--sample"])).toThrow(/Unknown argument/);
});
