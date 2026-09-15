// Server-only, dev-only. Putting the generated dataset into a database.
//
// Re-running is a replace, not a merge: every recipe the dataset owns is
// deleted first, then all of them are re-created. That keeps the database in
// one known state, so a screenshot taken today matches one taken next week.
// Ownership is by id, not by name — the ids are derived from the seed, so a
// recipe you wrote by hand is never touched even if it shares a name. Units,
// foods, aisles and tags are reference data and are reused rather than
// duplicated on the next run.
//
// Two things the recipe document cannot carry are applied afterwards:
// `created_at`/`updated_at`, because `create()` always stamps them with the
// current time and sorting by either needs a real spread; and the image, which
// has to exist on disk before the row can name it.
import type { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { imageFileName } from "../../domain/image";
import { recipeInputSchema } from "../../domain/recipe";
import { dataDir } from "../../server/core/boot";
import { orm } from "../connection/client";
import { recipe } from "../models/recipe/schema";
import { recipes as recipeRepository } from "../models/recipe/repo";
import { timeline as timelineRepository } from "../models/timeline/repo";
import { type DevRecipe, devIds, generateDevRecipes } from "./generate";
import { placeholderPng } from "./png";

/**
 * `<DATA_DIR>/images`, the same directory the upload route writes to. Computed
 * here rather than imported from src/server/images.ts: that module reaches the
 * database through `getDb`, which is Vite-only (`import.meta.glob`), and this
 * runs as a plain `bun` script.
 */
export function devImagesDir(root: string = dataDir()): string {
  return join(root, "images");
}

export type ApplyResult = {
  /** How many previously generated recipes were deleted. */
  removed: number;
  /** How many were created on this run. */
  created: number;
  /** How many placeholder images were written. */
  images: number;
};

/** Delete every recipe whose slug the dataset claims. Returns how many went. */
function removeExisting(db: Database, dataset: readonly DevRecipe[]): number {
  const repo = recipeRepository(db);
  let removed = 0;
  for (const item of dataset) {
    const slug = slugOf(item);
    const existing = repo.get(slug);
    if (existing && repo.remove(existing.id)) removed += 1;
  }
  return removed;
}

/** The slug the repository will derive for this recipe. */
function slugOf(item: DevRecipe): string {
  // Kept in one place: generate.ts documents that apply.ts matches on it.
  return item.input.name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Replace the dev dataset in `db`. Writes placeholder images into `dir`
 * (the real images directory by default).
 */
export async function applyDevData(db: Database, dataset: readonly DevRecipe[] = generateDevRecipes(), dir: string = devImagesDir()): Promise<ApplyResult> {
  const repo = recipeRepository(db);
  const events = timelineRepository(db);
  const dz = orm(db);

  const removed = removeExisting(db, dataset);

  let created = 0;
  let images = 0;
  for (const item of dataset) {
    const made = repo.create(recipeInputSchema.parse(item.input));
    created += 1;

    for (const event of item.timeline) events.create(made.id, event);

    if (item.imageHue !== null) {
      mkdirSync(dir, { recursive: true });
      const name = imageFileName(made.id, "png");
      await Bun.write(join(dir, name), placeholderPng(item.imageHue));
      repo.setImage(made.id, name);
      images += 1;
    }

    // Stamps last: setImage and the timeline writes must not move updated_at
    // afterwards, or every recipe would sort as though it changed just now.
    dz.update(recipe).set({ createdAt: item.createdAt, updatedAt: item.updatedAt }).where(eq(recipe.id, made.id)).run();
  }

  return { removed, created, images };
}
