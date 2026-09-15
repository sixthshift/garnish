import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tag = sqliteTable("tag", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(), // COLLATE NOCASE in the SQL; Drizzle has no collation builder
  slug: text("slug").notNull().unique(),
});
