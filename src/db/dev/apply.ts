import type { Database } from "bun:sqlite";
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { addDays, planEntryInputSchema, todayIso } from "../../domain/plan/plan";
import { recipeInputSchema } from "../../domain/recipes/recipe";
import { type ImageExtension, imageFileName } from "../../lib/imageFile";
import { dataDir } from "../../server/core/boot";
import { orm } from "../connection/client";
import { foodRepository } from "../models/food/repo";
import { planRepository } from "../models/plan/repo";
import { recipeRepository } from "../models/recipe/repo";
import { recipe } from "../models/recipe/schema";
import { timelineRepository } from "../models/timeline/repo";
import type { DevRecipe } from "./build";
import { DEV_LIBRARY, DEV_PLAN, type DevPlanEntry } from "./library";

/**
 * `<DATA_DIR>/images`, the same directory the upload route writes to. Computed
 * here rather than imported from src/server/api/images.ts: that module reaches the
 * database through `getDb`, which is Vite-only (`import.meta.glob`), and this
 * runs as a plain `bun` script.
 */
export function devImagesDir(root: string = dataDir()): string {
  return join(root, "images");
}

export type ApplyResult = {
  /** How many recipes were created. */
  created: number;
  /** How many photos were written, recipe photos and step photos alike. */
  images: number;
  /** How many plan entries were written. */
  planned: number;
};

export type ApplyOptions = {
  library?: readonly DevRecipe[];
  plan?: readonly DevPlanEntry[];
  /** Where the photos go; the real images directory by default. */
  dir?: string;
  /** The day the library's ages count back from and the plan's days count from. */
  today?: string;
};

/**
 * Where the library's photos live: real, freely licensed photos of each dish
 * and of some steps, credited in `./images/CREDITS.md`.
 */
export const DEV_PHOTOS_DIR = fileURLToPath(new URL("./images", import.meta.url));

/** Copy a library photo into `dir` under the name the app stores it by, `<id>.<ext>`. */
function copyPhoto(file: string, id: string, dir: string): string {
  mkdirSync(dir, { recursive: true });
  const ext = file.slice(file.lastIndexOf(".") + 1).toLowerCase() as ImageExtension;
  const name = imageFileName(id, ext);
  copyFileSync(join(DEV_PHOTOS_DIR, file), join(dir, name));
  return name;
}

/** An ISO timestamp `days` before `today`, at midday so no zone moves it to another date. */
const stamp = (today: string, days: number) => `${addDays(today, -days)}T12:00:00.000Z`;

/** The recipe document with each listed step's photo named, its file written into `<dir>/steps`. */
function withStepImages(item: DevRecipe, dir: string): { input: DevRecipe["input"]; written: number } {
  const wanted = new Map((item.stepImages ?? []).map((s) => [s.stepId, s.file]));
  if (wanted.size === 0) return { input: item.input, written: 0 };
  const stepsDir = join(dir, "steps");
  let written = 0;
  const parts: DevRecipe["input"]["parts"] = [];
  for (const p of item.input.parts) {
    const steps: NonNullable<(typeof p)["steps"]> = [];
    for (const s of p.steps ?? []) {
      const file = s.id === undefined ? undefined : wanted.get(s.id);
      if (s.id === undefined || file === undefined) {
        steps.push(s);
        continue;
      }
      const name = copyPhoto(file, s.id, stepsDir);
      written += 1;
      steps.push({ ...s, image: name });
    }
    parts.push({ ...p, steps });
  }
  return { input: { ...item.input, parts }, written };
}

/**
 * Write the dev library and its week into `db`, a freshly seeded database
 * (`bun run dev:seed` wipes before it calls this). Ages and plan days count
 * from `today`, so the library always reads as in use: made three days ago,
 * planned for tonight.
 */
export async function applyDevData(db: Database, options: ApplyOptions = {}): Promise<ApplyResult> {
  const { library = DEV_LIBRARY, plan = DEV_PLAN, dir = devImagesDir(), today = todayIso() } = options;
  const repo = recipeRepository(db);
  const events = timelineRepository(db);
  const foods = foodRepository(db);
  const plans = planRepository(db);
  const dz = orm(db);

  let created = 0;
  let images = 0;
  for (const item of library) {
    const { input, written } = withStepImages(item, dir);
    images += written;
    const made = repo.create(recipeInputSchema.parse(input));
    created += 1;

    // A sub-recipe: the seeded food it makes now links to it.
    if (item.makesFood !== undefined) foods.update(foods.findOrCreate(item.makesFood).id, { recipeId: made.id });

    for (const c of item.cooks) {
      events.create(made.id, { occurredOn: addDays(today, -c.daysAgo), message: c.message, image: null, servings: c.servings });
    }

    if (item.image !== null) {
      repo.ref(made.id).setImage(copyPhoto(item.image, made.id, dir));
      images += 1;
    }

    // Stamps last: setImage and the timeline writes must not move updated_at
    // afterwards, or every recipe would sort as though it changed just now.
    dz.update(recipe)
      .set({ createdAt: stamp(today, item.createdDaysAgo), updatedAt: stamp(today, item.updatedDaysAgo) })
      .where(eq(recipe.id, made.id))
      .run();
  }

  const entries = plans.addMany(
    plan.map((entry) =>
      planEntryInputSchema.parse({
        date: addDays(today, entry.day),
        recipeId: entry.recipe?.input.id ?? null,
        text: entry.text ?? "",
        servings: entry.servings ?? null,
        meal: entry.meal ?? null,
      })
    )
  );

  return { created, images, planned: entries.length };
}
