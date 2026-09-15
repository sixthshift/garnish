import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const aisle = sqliteTable("aisle", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(), // COLLATE NOCASE in the SQL; Drizzle has no collation builder
  position: integer("position").notNull().default(0),
});
