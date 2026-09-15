import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nowUtc } from "../columns";

export const migration = sqliteTable("migration", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  appliedAt: text("applied_at").notNull().default(nowUtc),
});
