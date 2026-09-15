// Server-only. Putting the seed data into a database, idempotently.
//
// Units are matched by name case-insensitively and existing rows are left
// alone, so a user's edits survive a re-seed; the house style statements are
// matched the same way on their whole text (M37.2), so a reworded statement is
// a new row and an untouched one is never duplicated. Sample recipes are matched by
// slug and saved through the recipe repository, so they take exactly the path
// the editor does; the units, foods and tags they name are resolved to existing
// rows or created, which is why this works with or without the units seed.
//
// The data itself is in ./units.ts, ./style.ts, ./recipes.ts and ./timeline.ts;
// the CLI that runs both is in ./cli.ts.
import type { Database } from "bun:sqlite";
import { type Recipe, recipeInputSchema } from "../../domain/recipe";
import { slugify } from "../../lib/names";
import { orm } from "../connection/client";
import { recipes } from "../models/recipe/repo";
import { timeline } from "../models/timeline/repo";
import { styleRules, type StyleRule } from "../models/style/repo";
import { units, type Unit } from "../models/unit/repo";
import { DEFAULT_STYLE_RULES } from "./style";
import { SAMPLE_RECIPES } from "./recipes";
import { SAMPLE_TIMELINE } from "./timeline";
import { DEFAULT_UNITS } from "./units";

export type SeedResult = { units: Unit[]; styleRules: StyleRule[] };

/**
 * Insert any default unit not already present (name compared
 * case-insensitively) and any house style statement whose text is not already
 * there (compared the same way). Runs in one transaction. Returns only the rows
 * created on this run, so the CLI and the tests can say what a run actually did.
 *
 * A statement the household has edited no longer matches its seeded text and so
 * comes back as a new row on the next start; that is the trade the text-match
 * makes, and it is the same one the units seed makes with a renamed unit. A
 * statement that was deleted outright returns for the same reason, at the foot
 * of the guide, where it can be switched off.
 */
export function seed(db: Database): SeedResult {
  const unitRepo = units(db);
  const styleRepo = styleRules(db);
  return orm(db).transaction((): SeedResult => {
    const existingUnits = new Set(unitRepo.list().map((u) => u.name.toLowerCase()));
    const madeUnits: Unit[] = [];
    for (const input of DEFAULT_UNITS) {
      if (existingUnits.has(input.name.toLowerCase())) continue;
      madeUnits.push(unitRepo.create(input));
    }

    const existingRules = new Set(styleRepo.list().map((r) => r.text.trim().toLowerCase()));
    const madeRules: StyleRule[] = [];
    for (const input of DEFAULT_STYLE_RULES) {
      if (existingRules.has(input.text.trim().toLowerCase())) continue;
      madeRules.push(styleRepo.create(input));
    }

    return { units: madeUnits, styleRules: madeRules };
  });
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
