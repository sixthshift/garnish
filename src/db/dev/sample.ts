import type { Database } from "bun:sqlite";
import { type Recipe, recipeInputSchema } from "../../domain/recipe";
import { slugify } from "../../lib/names";
import { ensureDataDir } from "../../server/core/boot";
import { orm } from "../connection/client";
import { databasePath, openDatabase } from "../connection/open";
import { migrate } from "../migrations/migrate";
import { recipeRepository } from "../models/recipe/repo";
import { timelineRepository } from "../models/timeline/repo";
import { seed } from "../seed/seed";
import { SAMPLE_RECIPES } from "./sampleRecipes";
import { SAMPLE_TIMELINE } from "./sampleTimeline";

export type SampleResult = { recipes: Recipe[] };

/**
 * Insert every sample recipe whose slug is not already taken, through the
 * recipe repository, in one transaction. Returns only the recipes created on
 * this run. The units and foods the samples name are the seed's
 * (`references.ts`), linked by name; run without the seed, the repository
 * makes them from the references, which carry the seeded attributes.
 *
 * A newly created recipe named in SAMPLE_TIMELINE also gets its "made this"
 * events, which pulls its `lastMade` up to the latest one.
 */
export function seedSample(db: Database): SampleResult {
  const repo = recipeRepository(db);
  const events = timelineRepository(db);
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

/** CLI arguments after the script name. Pure. There are none, so any argument throws rather than being silently ignored. */
export function parseSampleArgs(argv: readonly string[]): void {
  if (argv.length > 0) throw new Error(`Unknown argument ${argv[0]}. Usage: bun run dev:sample`);
}

// `bun run dev:sample`: the three hand-written recipes, added beside whatever
// is there. Unlike dev:seed it wipes nothing, so it is safe on a real database.
if (import.meta.main) {
  parseSampleArgs(process.argv.slice(2));
  const dir = ensureDataDir();
  const path = databasePath(dir);
  const db = openDatabase(path);
  try {
    await migrate(db);
    seed(db);
    const { recipes: created } = seedSample(db);
    console.log(
      created.length === 0
        ? `${path}: sample recipes already present`
        : `${path}: added ${created.length} sample recipes (${created.map((r) => r.name).join(", ")})`
    );
  } finally {
    db.close();
  }
}
