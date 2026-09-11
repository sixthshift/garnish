// Tags: the only organiser (decisions.md row 42). `name` is COLLATE NOCASE in
// the SQL; the slug is derived from the name and de-duplicated.
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tag = sqliteTable("tag", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
});
