import { real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Adjustment, CookMessage, CookNote } from "../../../domain/recipes/cooking";
import { nowUtc } from "../columns";
import { recipe } from "../recipe/schema";

/** One recipe's cooking session (032_cook_session.sql): its lists as JSON, read whole. */
export const cookSession = sqliteTable("cook_session", {
  id: text("id").primaryKey(),
  recipeId: text("recipe_id")
    .notNull()
    .unique()
    .references(() => recipe.id, { onDelete: "cascade" }),
  servings: real("servings"),
  choices: text("choices", { mode: "json" }).$type<Record<string, string>>(),
  adjustments: text("adjustments", { mode: "json" }).$type<Adjustment[]>().notNull().default([]),
  notes: text("notes", { mode: "json" }).$type<CookNote[]>().notNull().default([]),
  messages: text("messages", { mode: "json" }).$type<CookMessage[]>().notNull().default([]),
  startedAt: text("started_at").notNull().default(nowUtc),
  updatedAt: text("updated_at").notNull().default(nowUtc),
});
