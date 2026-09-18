import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nowUtc } from "../columns";

/**
 * One statement of the planner guide — `style_rule`'s shape exactly, because
 * it is the same object read to a different pass: `text` is the whole
 * instruction sentence, `enabled` is whether it is read out at all, and
 * `position` is the order it is numbered in and is deliberately not unique, as
 * a reorder rewrites every row in one transaction.
 */
export const plannerRule = sqliteTable(
  "planner_rule",
  {
    id: text("id").primaryKey(),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(nowUtc),
    updatedAt: text("updated_at").notNull().default(nowUtc),
  },
  (t) => [check("enabled_flag", sql`${t.enabled} IN (0, 1)`)]
);
