// The house style guide: the statements the restyle pass is told, in order
// (decisions.md row 78). Mirrors 010_style.sql.
import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nowUtc } from "../columns";

/**
 * One statement of the guide. `text` is the whole instruction sentence, because
 * the text is what goes to the model; nothing switches on it. `enabled` is the
 * default for a run rather than a lock — the restyle sheet starts from it and
 * the household ticks per recipe. `position` is the guide's order and is
 * deliberately not unique, as a reorder rewrites every row in one transaction.
 */
export const styleRule = sqliteTable(
  "style_rule",
  {
    id: text("id").primaryKey(),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(nowUtc),
    updatedAt: text("updated_at").notNull().default(nowUtc),
  },
  (t) => [check("enabled_flag", sql`${t.enabled} IN (0, 1)`)],
);
