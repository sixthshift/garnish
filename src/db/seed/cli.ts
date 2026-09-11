// `bun run seed [--sample]`. Opens DATA_DIR's database, migrates it, seeds the
// reference units, and with --sample adds the demo recipes.
import { ensureDataDir } from "../../server/boot";
import { databasePath, openDatabase } from "../connection/open";
import { migrate } from "../migrations/migrate";
import { seed, seedSample } from "./seed";

export type SeedFlags = { sample: boolean };

/** CLI flags after the script name. Pure. Unknown flags throw so a typo does not silently seed nothing. */
export function parseSeedFlags(argv: readonly string[]): SeedFlags {
  const flags: SeedFlags = { sample: false };
  for (const arg of argv) {
    if (arg === "--sample") flags.sample = true;
    else throw new Error(`Unknown argument ${arg}. Usage: bun run seed [--sample]`);
  }
  return flags;
}

if (import.meta.main) {
  const flags = parseSeedFlags(process.argv.slice(2));
  const dir = ensureDataDir();
  const path = databasePath(dir);
  const db = openDatabase(path);
  try {
    await migrate(db);
    const { units: added } = seed(db);
    console.log(
      added.length === 0 ? `${path}: units already seeded` : `${path}: seeded ${added.length} units (${added.map((u) => u.name).join(", ")})`,
    );
    if (flags.sample) {
      const { recipes: created } = seedSample(db);
      console.log(
        created.length === 0
          ? `${path}: sample recipes already present`
          : `${path}: seeded ${created.length} sample recipes (${created.map((r) => r.name).join(", ")})`,
      );
    }
  } finally {
    db.close();
  }
}
