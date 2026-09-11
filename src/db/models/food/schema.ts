// Ingredient foods. `name` is COLLATE NOCASE in the SQL. A food may point at a
// recipe (the sub-recipe hook); the behaviour is deferred, the column is not.
import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { aisle } from "../aisle/schema";
import { recipe } from "../recipe/schema";

export const food = sqliteTable(
  "food",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    pluralName: text("plural_name"),
    /** JSON array of strings; `{ mode: "json" }` parses and serialises it. */
    aliases: text("aliases", { mode: "json" }).$type<string[]>().notNull().default([]),
    aisleId: text("aisle_id").references(() => aisle.id, { onDelete: "set null" }),
    /** Sub-recipe hook; behaviour deferred (scope.md). */
    recipeId: text("recipe_id").references(() => recipe.id, { onDelete: "set null" }),
    skipShopping: integer("skip_shopping", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    index("food_aisle_id").on(t.aisleId),
    index("food_recipe_id").on(t.recipeId),
    check("skip_shopping_flag", sql`${t.skipShopping} IN (0, 1)`),
  ],
);
