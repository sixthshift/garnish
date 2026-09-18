import { ensureDataDir } from "../../server/core/boot";
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
    const {
      units: added,
      styleRules: rules,
      rewordedStyleRules: reworded,
      retiredStyleRules: retired,
      plannerRules: plannerMade,
      rewordedPlannerRules: plannerReworded,
      retiredPlannerRules: plannerRetired,
    } = seed(db);
    console.log(added.length === 0 ? `${path}: units already seeded` : `${path}: seeded ${added.length} units (${added.map((u) => u.name).join(", ")})`);
    console.log(rules.length === 0 ? `${path}: house style already seeded` : `${path}: seeded ${rules.length} house style statements`);
    if (reworded.length > 0) console.log(`${path}: reworded ${reworded.length} house style statements in place`);
    if (retired.length > 0) console.log(`${path}: removed ${retired.length} house style statements now said by another`);
    console.log(plannerMade.length === 0 ? `${path}: planner guide already seeded` : `${path}: seeded ${plannerMade.length} planner statements`);
    if (plannerReworded.length > 0) console.log(`${path}: reworded ${plannerReworded.length} planner statements in place`);
    if (plannerRetired.length > 0) console.log(`${path}: removed ${plannerRetired.length} planner statements now said by another`);
    if (flags.sample) {
      const { recipes: created } = seedSample(db);
      console.log(
        created.length === 0
          ? `${path}: sample recipes already present`
          : `${path}: seeded ${created.length} sample recipes (${created.map((r) => r.name).join(", ")})`
      );
    }
  } finally {
    db.close();
  }
}
