// Server-only. Reference data every fresh database gets: the common metric and
// imperial units. Idempotent: rows are matched by name case-insensitively and
// existing ones are left alone, so a user's edits survive a re-seed.
// `bun run seed --sample` also inserts the demo recipes from ./sample.ts.
import type { Database } from "bun:sqlite";
import { ensureDataDir } from "../server/boot";
import { databasePath, migrate, openDatabase } from "./migrate";
import { units, type Unit, type UnitInput } from "./units";

/** Default units, en-AU spelling. Fraction off for weights and volumes measured on a scale or jug. */
export const DEFAULT_UNITS: readonly UnitInput[] = [
  // metric
  { name: "gram", pluralName: "grams", abbreviation: "g", useAbbreviation: true, fraction: false },
  { name: "kilogram", pluralName: "kilograms", abbreviation: "kg", useAbbreviation: true, fraction: false },
  { name: "millilitre", pluralName: "millilitres", abbreviation: "ml", useAbbreviation: true, fraction: false },
  { name: "litre", pluralName: "litres", abbreviation: "l", useAbbreviation: true, fraction: false },
  // kitchen measures
  { name: "teaspoon", pluralName: "teaspoons", abbreviation: "tsp", useAbbreviation: true, fraction: true },
  { name: "tablespoon", pluralName: "tablespoons", abbreviation: "tbsp", useAbbreviation: true, fraction: true },
  { name: "cup", pluralName: "cups", abbreviation: "cup", useAbbreviation: false, fraction: true },
  // imperial
  { name: "ounce", pluralName: "ounces", abbreviation: "oz", useAbbreviation: true, fraction: false },
  { name: "pound", pluralName: "pounds", abbreviation: "lb", useAbbreviation: true, fraction: false },
  // counts
  { name: "pinch", pluralName: "pinches", abbreviation: "pinch", useAbbreviation: false, fraction: true },
  { name: "piece", pluralName: "pieces", abbreviation: "pc", useAbbreviation: false, fraction: true },
  { name: "slice", pluralName: "slices", abbreviation: "slice", useAbbreviation: false, fraction: true },
  { name: "clove", pluralName: "cloves", abbreviation: "clove", useAbbreviation: false, fraction: true },
  { name: "can", pluralName: "cans", abbreviation: "can", useAbbreviation: false, fraction: true },
  { name: "bunch", pluralName: "bunches", abbreviation: "bunch", useAbbreviation: false, fraction: true },
];

export type SeedResult = { units: Unit[] };

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

/**
 * Insert any default unit not already present (name compared case-insensitively).
 * Runs in one transaction. Returns only the rows created on this run.
 */
export function seed(db: Database): SeedResult {
  const repo = units(db);
  const run = db.transaction((): Unit[] => {
    const existing = new Set(repo.list().map((u) => u.name.toLowerCase()));
    const created: Unit[] = [];
    for (const input of DEFAULT_UNITS) {
      if (existing.has(input.name.toLowerCase())) continue;
      created.push(repo.create(input));
    }
    return created;
  });
  return { units: run() };
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
      const { seedSample } = await import("./sample");
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
