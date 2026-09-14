// `bun run dev:seed [--count N] [--seed TEXT]`. Dev only — this never ships;
// `.dockerignore` keeps src/db/dev out of the image entirely, which is also why
// it is its own script rather than part of the server entry. Nothing runs it
// automatically; `bun run dev` leaves the database alone.
//
// A clean slate in three steps:
//
//   1. wipe DATA_DIR's database, its WAL sidecars and the images directory
//   2. migrate, then run the same `seed()` the server runs on every start,
//      dev or not — the default units, so the generated recipes resolve real
//      ones rather than inventing their own
//   3. apply the generated dev dataset
//
// Step 2 is the production seed on purpose: dev should be looking at the
// reference data a real install has, not a parallel set that only exists here.
import { ensureDataDir } from "../../server/core/boot";
import { databasePath, openDatabase } from "../connection/open";
import { migrate } from "../migrations/migrate";
import { seed } from "../seed/seed";
import { applyDevData } from "./apply";
import { DEV_RECIPE_COUNT, DEV_SEED, generateDevRecipes } from "./generate";
import { wipeDataDir } from "./wipe";

export type DevSeedFlags = { count: number; seed: string };

/**
 * CLI flags after the script name. Pure. Unknown flags and unusable values
 * throw, so a typo does not silently rebuild the database with defaults.
 */
export function parseDevSeedFlags(argv: readonly string[]): DevSeedFlags {
  const flags: DevSeedFlags = { count: DEV_RECIPE_COUNT, seed: DEV_SEED };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--count") {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1) throw new Error(`--count needs a positive whole number, got ${argv[i] ?? "nothing"}`);
      flags.count = value;
    } else if (arg === "--seed") {
      const value = argv[++i];
      if (!value) throw new Error("--seed needs a value");
      flags.seed = value;
    } else {
      throw new Error(`Unknown argument ${arg}. Usage: bun run dev:seed [--count N] [--seed TEXT]`);
    }
  }
  return flags;
}

if (import.meta.main) {
  // This deletes a database. It is a dev command and says so in its name, but
  // refusing outright under NODE_ENV=production is cheap insurance against a
  // stray `bun run dev:seed` on a box that has real recipes on it.
  if (process.env.NODE_ENV === "production") {
    throw new Error("dev:seed wipes the database and will not run with NODE_ENV=production");
  }

  const flags = parseDevSeedFlags(process.argv.slice(2));
  const dir = ensureDataDir();

  const { removed } = wipeDataDir(dir);
  console.log(removed.length === 0 ? `${dir}: nothing to wipe` : `${dir}: wiped ${removed.join(", ")}`);

  const path = databasePath(dir);
  const db = openDatabase(path);
  try {
    await migrate(db);
    const { units } = seed(db);
    console.log(`${path}: migrated, seeded ${units.length} units`);

    const dataset = generateDevRecipes(flags.seed, flags.count);
    const { created, images } = await applyDevData(db, dataset);
    console.log(`${path}: created ${created} dev recipes (${images} with a placeholder image), seed "${flags.seed}"`);
  } finally {
    db.close();
  }
}
