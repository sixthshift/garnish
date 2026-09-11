// Server-only. Putting the seed data into a database, idempotently.
//
// Units are matched by name case-insensitively and existing rows are left
// alone, so a user's edits survive a re-seed. Sample recipes are matched by
// slug and saved through the recipe repository, so they take exactly the path
// the editor does; the units, foods and tags they name are resolved to existing
// rows or created, which is why this works with or without the units seed.
//
// The data itself is in ./units.ts, ./recipes.ts and ./timeline.ts; the CLI
// that runs both is in ./cli.ts.
import type { Database } from "bun:sqlite";
import type { Recipe } from "../../domain/recipe";
import { recipeInputSchema } from "../../domain/recipe";
import { slugify } from "../../domain/names";
import { orm } from "../connection/client";
import { recipes } from "../models/recipe/repo";
import { timeline } from "../models/timeline/repo";
import { units, type Unit } from "../models/unit/repo";
import { SAMPLE_RECIPES } from "./recipes";
import { SAMPLE_TIMELINE } from "./timeline";
import { DEFAULT_UNITS } from "./units";

export type SeedResult = { units: Unit[] };

/**
 * Insert any default unit not already present (name compared case-insensitively).
 * Runs in one transaction. Returns only the rows created on this run.
 */
export function seed(db: Database): SeedResult {
  const repo = units(db);
  const created = orm(db).transaction((): Unit[] => {
    const existing = new Set(repo.list().map((u) => u.name.toLowerCase()));
    const made: Unit[] = [];
    for (const input of DEFAULT_UNITS) {
      if (existing.has(input.name.toLowerCase())) continue;
      made.push(repo.create(input));
    }
    return made;
  });
  return { units: created };
}

export type SampleResult = { recipes: Recipe[] };

/**
 * Insert every sample recipe whose slug is not already taken, through the
 * recipe repository, in one transaction. Returns only the recipes created on
 * this run. Units, foods and tags the samples name are matched to existing
 * rows case-insensitively and created when missing, so this works with or
 * without the units seed (the CLI runs that first).
 *
 * A newly created recipe named in SAMPLE_TIMELINE also gets its "made this"
 * events, which pulls its `lastMade` up to the latest one.
 */
export function seedSample(db: Database): SampleResult {
  const repo = recipes(db);
  const events = timeline(db);
  const created = orm(db).transaction((): Recipe[] => {
    const made: Recipe[] = [];
    for (const doc of SAMPLE_RECIPES) {
      if (repo.get(slugify(doc.name)) !== null) continue;
      const recipe = repo.create(recipeInputSchema.parse(doc));
      const inputs = SAMPLE_TIMELINE[doc.name];
      if (!inputs) {
        made.push(recipe);
        continue;
      }
      for (const input of inputs) events.create(recipe.id, input);
      made.push(repo.get(recipe.slug)!);
    }
    return made;
  });
  return { recipes: created };
}
