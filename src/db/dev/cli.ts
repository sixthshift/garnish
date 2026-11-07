import { ensureDataDir } from "../../server/core/boot";
import { databasePath, openDatabase } from "../connection/open";
import { migrate } from "../migrations/migrate";
import { seed } from "../seed/seed";
import { applyDevData } from "./apply";
import { wipeDataDir } from "./wipe";

/** CLI arguments after the script name. Pure. There are none, so any argument throws rather than being silently ignored. */
export function parseDevSeedArgs(argv: readonly string[]): void {
  if (argv.length > 0) throw new Error(`Unknown argument ${argv[0]}. Usage: bun run dev:seed`);
}

if (import.meta.main) {
  // This deletes a database. It is a dev command and says so in its name, but
  // refusing outright under NODE_ENV=production is cheap insurance against a
  // stray `bun run dev:seed` on a box that has real recipes on it.
  if (process.env.NODE_ENV === "production") {
    throw new Error("dev:seed wipes the database and will not run with NODE_ENV=production");
  }

  parseDevSeedArgs(process.argv.slice(2));
  const dir = ensureDataDir();

  const { removed } = wipeDataDir(dir);
  console.log(removed.length === 0 ? `${dir}: nothing to wipe` : `${dir}: wiped ${removed.join(", ")}`);

  const path = databasePath(dir);
  const db = openDatabase(path);
  try {
    await migrate(db);
    // The production seed, on purpose: dev looks at the reference data a real install has.
    const { units, foods } = seed(db);
    console.log(`${path}: migrated, seeded ${units.length} units and ${foods.length} starter foods`);

    const { created, images, planned } = await applyDevData(db);
    console.log(`${path}: created ${created} recipes (${images} photos) and ${planned} plan entries around today`);
  } finally {
    db.close();
  }
}
