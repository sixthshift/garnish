// Shopping aisles (Mealie's labels). `name` is COLLATE NOCASE in the SQL.
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const aisle = sqliteTable("aisle", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  position: integer("position").notNull().default(0),
});
