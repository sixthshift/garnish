// Units of measure. `name` is COLLATE NOCASE in the SQL; `standard_unit_id` is
// the conversion hook, pointing at another unit (deferred, see scope.md).
import { sql } from "drizzle-orm";
import { type AnySQLiteColumn, check, index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const unit = sqliteTable(
  "unit",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    pluralName: text("plural_name"),
    abbreviation: text("abbreviation").notNull().default(""),
    useAbbreviation: integer("use_abbreviation", { mode: "boolean" }).notNull().default(false),
    fraction: integer("fraction", { mode: "boolean" }).notNull().default(true),
    standardQuantity: real("standard_quantity"),
    standardUnitId: text("standard_unit_id").references((): AnySQLiteColumn => unit.id, { onDelete: "set null" }),
  },
  (t) => [
    index("unit_standard_unit_id").on(t.standardUnitId),
    check("use_abbreviation_flag", sql`${t.useAbbreviation} IN (0, 1)`),
    check("fraction_flag", sql`${t.fraction} IN (0, 1)`),
  ]
);
