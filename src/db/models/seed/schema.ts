import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nowUtc } from "../columns";

/** A seed batch applied to this database, by name: once in, never applied again (018_seed_batch.sql). */
export const seedBatch = sqliteTable("seed_batch", {
  name: text("name").primaryKey(),
  appliedAt: text("applied_at").notNull().default(nowUtc),
});
