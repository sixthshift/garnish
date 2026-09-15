import { sql } from "drizzle-orm";
import { check, index, integer, real, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { aisle } from "../aisle/schema";
import { recipe } from "../recipe/schema";
import { unit } from "../unit/schema";

export const food = sqliteTable(
  "food",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(), // COLLATE NOCASE in the SQL; Drizzle has no collation builder
    pluralName: text("plural_name"),
    /** JSON array of strings; `{ mode: "json" }` parses and serialises it. */
    aliases: text("aliases", { mode: "json" }).$type<string[]>().notNull().default([]),
    aisleId: text("aisle_id").references(() => aisle.id, { onDelete: "set null" }),
    /** Sub-recipe hook; behaviour deferred (scope.md). */
    recipeId: text("recipe_id").references(() => recipe.id, { onDelete: "set null" }),
    skipShopping: integer("skip_shopping", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("food_aisle_id").on(t.aisleId), index("food_recipe_id").on(t.recipeId), check("skip_shopping_flag", sql`${t.skipShopping} IN (0, 1)`)]
);

/**
 * "1 cup of plain flour is 125 g". The conversion hangs
 * off the food because the answer depends on the ingredient, not on the unit;
 * `unit.standardQuantity` / `unit.standardUnitId` keep the unit-to-unit ones.
 * Both units cascade: a conversion missing a side is not a conversion.
 */
export const foodConversion = sqliteTable(
  "food_conversion",
  {
    id: text("id").primaryKey(),
    foodId: text("food_id")
      .notNull()
      .references(() => food.id, { onDelete: "cascade" }),
    unitId: text("unit_id")
      .notNull()
      .references(() => unit.id, { onDelete: "cascade" }),
    quantity: real("quantity").notNull(),
    toUnitId: text("to_unit_id")
      .notNull()
      .references(() => unit.id, { onDelete: "cascade" }),
    toQuantity: real("to_quantity").notNull(),
  },
  (t) => [
    index("food_conversion_food_id").on(t.foodId),
    index("food_conversion_unit_id").on(t.unitId),
    index("food_conversion_to_unit_id").on(t.toUnitId),
    check("conversion_quantity_positive", sql`${t.quantity} > 0`),
    check("conversion_to_quantity_positive", sql`${t.toQuantity} > 0`),
    check("conversion_units_differ", sql`${t.unitId} <> ${t.toUnitId}`),
    unique("food_conversion_food_id_unit_id_to_unit_id").on(t.foodId, t.unitId, t.toUnitId),
  ]
);
