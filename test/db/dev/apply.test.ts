// Applying the dev library to a fresh database: recipes, photos, cook log,
// sub-recipe links and the week's plan, all dated from the day it runs.
import type { Database } from "bun:sqlite";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, expect, test } from "vitest";
import { openDatabase } from "../../../src/db/connection/open";
import { applyDevData } from "../../../src/db/dev/apply";
import { parseDevSeedArgs } from "../../../src/db/dev/cli";
import { DEV_LIBRARY, DEV_PLAN } from "../../../src/db/dev/library";
import { migrate } from "../../../src/db/migrations/migrate";
import { foodRepository } from "../../../src/db/models/food/repo";
import { planRepository } from "../../../src/db/models/plan/repo";
import { recipeRepository } from "../../../src/db/models/recipe/repo";
import { timelineRepository } from "../../../src/db/models/timeline/repo";
import { seed } from "../../../src/db/seed/seed";

const TODAY = "2026-11-08";

let db: Database;
let images: string;

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  seed(db);
  images = mkdtempSync(join(tmpdir(), "garnish-dev-images-"));
});

test("creates the library, its photos and the week's plan", async () => {
  const result = await applyDevData(db, { dir: images, today: TODAY });
  const photos = DEV_LIBRARY.filter((r) => r.image !== null).length;
  const stepPhotos = DEV_LIBRARY.reduce((n, r) => n + (r.stepImages?.length ?? 0), 0);

  expect(result).toEqual({ created: DEV_LIBRARY.length, images: photos + stepPhotos, planned: DEV_PLAN.length });
  expect(recipeRepository(db).query()).toHaveLength(DEV_LIBRARY.length);
  expect(readdirSync(images).filter((f) => f.includes("."))).toHaveLength(photos);
  expect(readdirSync(join(images, "steps"))).toHaveLength(stepPhotos);
});

test("ages, cooks and plan days count from today", async () => {
  await applyDevData(db, { dir: images, today: TODAY });
  const ragu = DEV_LIBRARY.find((r) => r.input.name === "Slow-Cooked Beef Ragu")!;
  const row = db.query<{ created_at: string }, [string]>("SELECT created_at FROM recipe WHERE id = ?").get(ragu.input.id!)!;
  expect(row.created_at).toBe(`2026-10-04T12:00:00.000Z`); // 35 days before

  const log = timelineRepository(db).list(ragu.input.id!);
  expect(log).toHaveLength(ragu.cooks.length);
  expect(log.map((e) => e.occurredOn)).toContain("2026-11-05"); // 3 days before

  const week = planRepository(db).week("2026-11-02");
  const tonight = week.find((d) => d.date === TODAY)!;
  expect(tonight.entries.length).toBeGreaterThan(0);
});

test("a sub-recipe's food links to it, and the rows using that food follow", async () => {
  await applyDevData(db, { dir: images, today: TODAY });
  const repo = recipeRepository(db);
  for (const child of DEV_LIBRARY.filter((r) => r.makesFood !== undefined)) {
    expect(foodRepository(db).findOrCreate(child.makesFood!).recipeId).toBe(child.input.id);
  }
  const ragu = repo.get("slow-cooked-beef-ragu")!;
  const stock = ragu.parts.flatMap((p) => p.ingredients).find((l) => l.food?.name === "chicken stock")!;
  expect(stock.food!.recipeId).toBe(repo.get("chicken-stock")!.id);
});

test("step photos are written and named on their steps", async () => {
  await applyDevData(db, { dir: images, today: TODAY });
  const ragu = recipeRepository(db).get("slow-cooked-beef-ragu")!;
  const photographed = ragu.parts.flatMap((p) => p.steps).filter((s) => s.image !== null);
  expect(photographed.length).toBeGreaterThan(0);
  for (const s of photographed) expect(existsSync(join(images, "steps", s.image!))).toBe(true);
});

test("the command takes no arguments, and a stray one throws", () => {
  expect(() => parseDevSeedArgs([])).not.toThrow();
  expect(() => parseDevSeedArgs(["--count", "12"])).toThrow(/Unknown argument/);
});
