// The shopping list: one household list and the provenance of each of its lines
// (decisions.md row 67). Mirrors 005_shopping.sql.
import { sql } from "drizzle-orm";
import { check, index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nowUtc } from "../columns";
import { food } from "../food/schema";
import { recipe } from "../recipe/schema";
import { unit } from "../unit/schema";

/**
 * One line of the one list. A food line has `foodId` with an optional `unitId`
 * and `quantity`; a free-text line has `text`. `position` is the list order and
 * is deliberately not unique — a reorder rewrites every row in one transaction.
 */
export const shoppingItem = sqliteTable(
  "shopping_item",
  {
    id: text("id").primaryKey(),
    position: integer("position").notNull(),
    foodId: text("food_id").references(() => food.id, { onDelete: "set null" }),
    unitId: text("unit_id").references(() => unit.id, { onDelete: "set null" }),
    /** NULL: no amount ("olive oil"). */
    quantity: real("quantity"),
    text: text("text").notNull().default(""),
    ticked: integer("ticked", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(nowUtc),
    updatedAt: text("updated_at").notNull().default(nowUtc),
  },
  (t) => [
    index("shopping_item_food_id").on(t.foodId),
    index("shopping_item_unit_id").on(t.unitId),
    check("ticked_flag", sql`${t.ticked} IN (0, 1)`),
  ],
);

/**
 * Where a line came from — Mealie's `recipeReferences`. The recipe and part
 * names are copies, not joins, so an expanded line still reads "Lemon tart,
 * Pastry, serves 4" after the recipe has been deleted or renamed; `recipeId` is
 * the live link while the recipe exists and goes null with it.
 */
export const shoppingItemSource = sqliteTable(
  "shopping_item_source",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => shoppingItem.id, { onDelete: "cascade" }),
    recipeId: text("recipe_id").references(() => recipe.id, { onDelete: "set null" }),
    recipeName: text("recipe_name").notNull().default(""),
    partName: text("part_name").notNull().default(""),
    /** The servings the recipe was added at, for "serves 4" in the expansion. */
    servings: real("servings"),
    /** What this source contributed to the line's quantity. */
    quantity: real("quantity"),
  },
  (t) => [
    index("shopping_item_source_item_id").on(t.itemId),
    index("shopping_item_source_recipe_id").on(t.recipeId),
  ],
);
