// drizzle-kit config. Used only to *generate* migration SQL from
// src/db/models/**/schema.ts — `src/db/migrations/migrate.ts` is still what applies migrations, and
// `migrations/NNN_name.sql` is still what a database is built from.
//
//   bun run db:generate          # writes SQL into .drizzle/
//   # review it, then copy the statements into src/db/migrations/NNN_name.sql
//
// The generated file is deliberately not written straight into migrations/:
// drizzle-kit names files its own way (`0000_lively_moon.sql`) and keeps a
// journal beside them, neither of which this project's runner reads. Keeping
// generation in a scratch directory means one numbering scheme and one runner
// (decisions.md row 46).
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/models/**/schema.ts",
  out: "./.drizzle",
});
