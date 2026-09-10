// Server-only. Reference data every fresh database gets: the common metric and
// imperial units. Idempotent: rows are matched by name case-insensitively and
// existing ones are left alone, so a user's edits survive a re-seed.
// `--sample` (demo recipes) is deferred to M9.1.
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
  const dir = ensureDataDir();
  const path = databasePath(dir);
  const db = openDatabase(path);
  try {
    await migrate(db);
    const { units: added } = seed(db);
    console.log(
      added.length === 0 ? `${path}: units already seeded` : `${path}: seeded ${added.length} units (${added.map((u) => u.name).join(", ")})`,
    );
  } finally {
    db.close();
  }
}
