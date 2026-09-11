// The recipe aggregate: the recipe row and the five tables it owns.
//
// They live in one file because they are written as one thing — `repo.ts`
// replaces a recipe's components, ingredients, steps, notes and tag links in a
// single transaction, and nothing addresses them independently. The aggregate
// is the boundary, so it is also the file.
//
// Mealie's field names where Mealie has the concept; the two times are integer
// minutes rather than free text (decisions.md row 35).
import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";
import { nowUtc } from "../columns";
import { food } from "../food/schema";
import { tag } from "../tag/schema";
import { unit } from "../unit/schema";

export const recipe = sqliteTable(
  "recipe",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    image: text("image"),
    rating: real("rating"),
    lastMade: text("last_made"),
    servings: real("servings").notNull().default(0),
    yieldQuantity: real("yield_quantity").notNull().default(0),
    yieldUnitId: text("yield_unit_id").references(() => unit.id, { onDelete: "set null" }),
    yieldText: text("yield_text").notNull().default(""),
    prepMinutes: integer("prep_minutes"),
    cookMinutes: integer("cook_minutes"),
    sourceUrl: text("source_url"),
    createdAt: text("created_at").notNull().default(nowUtc),
    updatedAt: text("updated_at").notNull().default(nowUtc),
    // 002_stage2.sql
    favourite: integer("favourite", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    index("recipe_yield_unit_id").on(t.yieldUnitId),
    check("rating_range", sql`${t.rating} IS NULL OR (${t.rating} >= 0 AND ${t.rating} <= 5)`),
    check("favourite_flag", sql`${t.favourite} IN (0, 1)`),
  ],
);

/** Recipe notes, ordered within their recipe. */
export const recipeNote = sqliteTable(
  "recipe_note",
  {
    id: text("id").primaryKey(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull().default(""),
    text: text("text").notNull().default(""),
  },
  (t) => [unique().on(t.recipeId, t.position)],
);

/**
 * A named part of a recipe, owning its ingredients. Every recipe has at least
 * one; a single unnamed component is the flat case.
 */
export const component = sqliteTable(
  "component",
  {
    id: text("id").primaryKey(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    /** '' is the single unnamed component (the flat recipe). */
    name: text("name").notNull().default(""),
  },
  (t) => [unique().on(t.recipeId, t.position)],
);

/**
 * One ingredient line, owned by a component. `original_text` is always kept, so
 * a line that parsed into nothing still round-trips.
 *
 * `foodId` and `food/schema.ts`'s `recipeId` point at each other's tables (the
 * sub-recipe hook), so the two modules form an import cycle. It resolves
 * because `references()` takes a callback: nothing dereferences the other
 * module at load time. The explicit `AnySQLiteColumn` return type is what lets
 * TypeScript accept the self-referential inference.
 */
export const ingredient = sqliteTable(
  "ingredient",
  {
    id: text("id").primaryKey(),
    componentId: text("component_id")
      .notNull()
      .references(() => component.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    /** NULL: no amount ("salt to taste"). */
    quantity: real("quantity"),
    unitId: text("unit_id").references(() => unit.id, { onDelete: "set null" }),
    foodId: text("food_id").references((): AnySQLiteColumn => food.id, { onDelete: "set null" }),
    note: text("note").notNull().default(""),
    originalText: text("original_text").notNull().default(""),
    /** Has an amount, does not scale. Cooklang's `=`. */
    fixed: integer("fixed", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    unique().on(t.componentId, t.position),
    index("ingredient_unit_id").on(t.unitId),
    index("ingredient_food_id").on(t.foodId),
    check("fixed_flag", sql`${t.fixed} IN (0, 1)`),
  ],
);

/**
 * A method step. Steps belong to the recipe and may point at a component;
 * `position` is recipe-wide, so component steps and loose steps share one order.
 */
export const step = sqliteTable(
  "step",
  {
    id: text("id").primaryKey(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    componentId: text("component_id").references(() => component.id, { onDelete: "set null" }),
    position: integer("position").notNull(),
    text: text("text").notNull().default(""),
  },
  (t) => [unique().on(t.recipeId, t.position), index("step_component_id").on(t.componentId)],
);

/** Recipe-to-tag links. The primary key is the pair, so a recipe carries a tag at most once. */
export const recipeTag = sqliteTable(
  "recipe_tag",
  {
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.recipeId, t.tagId] }), index("recipe_tag_tag_id").on(t.tagId)],
);
