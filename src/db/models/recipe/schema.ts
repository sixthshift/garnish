import { sql } from "drizzle-orm";
import { type AnySQLiteColumn, check, index, integer, primaryKey, real, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { nowUtc } from "../columns";
import { food } from "../food/schema";
import { tag } from "../tag/schema";
import { unit } from "../unit/schema";

/** What `part.source_part` holds: the part before its first restyle. */
export type SourcePart = { steps: { title: string; text: string; summary: string }[]; notes: string[] };

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
    // 011_restyle.sql: when the steps were last rewritten in the house style,
    // NULL while they are still the author's words.
    restyledAt: text("restyled_at"),
  },
  (t) => [
    index("recipe_yield_unit_id").on(t.yieldUnitId),
    check("rating_range", sql`${t.rating} IS NULL OR (${t.rating} >= 0 AND ${t.rating} <= 5)`),
    check("favourite_flag", sql`${t.favourite} IN (0, 1)`),
  ]
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
  (t) => [unique().on(t.recipeId, t.position)]
);

/**
 * A named part of a recipe, owning its ingredients and its steps. Every recipe
 * has at least one; a single unnamed part is the flat case, and among named
 * parts the unnamed one is the recipe's main body.
 */
export const part = sqliteTable(
  "part",
  {
    id: text("id").primaryKey(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    /** '' is the unnamed part: the flat recipe, or the main body beside named parts. */
    name: text("name").notNull().default(""),
    /**
     * 017_source_part.sql: the part as the author left it — its steps with
     * their labels and supporting lines, and one note per ingredient row in
     * position order — as JSON; NULL until the first restyle. Written once and
     * cleared by a restore, so it is always the author's words or nothing.
     * `{ mode: "json" }` parses and serialises it, as `food.aliases` does.
     */
    sourcePart: text("source_part", { mode: "json" }).$type<SourcePart>(),
  },
  (t) => [unique().on(t.recipeId, t.position)]
);

/**
 * One ingredient line, owned by a part. `original_text` is always kept, so a
 * line that parsed into nothing still round-trips.
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
    partId: text("part_id")
      .notNull()
      .references(() => part.id, { onDelete: "cascade" }),
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
    unique().on(t.partId, t.position),
    index("ingredient_unit_id").on(t.unitId),
    index("ingredient_food_id").on(t.foodId),
    check("fixed_flag", sql`${t.fixed} IN (0, 1)`),
  ]
);

/**
 * A method step, owned by a part. `position` is scoped to the part, so a step
 * has exactly one container and one place in it. The
 * recipe is reached through the part rather than stored again here.
 */
export const step = sqliteTable(
  "step",
  {
    id: text("id").primaryKey(),
    partId: text("part_id")
      .notNull()
      .references(() => part.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull().default(""),
    /** File name under `data/images/steps/`, or NULL for a step with no photo. */
    image: text("image"),
    // 016_step_fields.sql added the next two, so they sit after `image` here:
    // `ALTER TABLE` appends, and `drift.test.ts` holds this order to the table's.
    /** The step's label, '' when it has none. Mealie's `RecipeStep.title`. */
    title: text("title").notNull().default(""),
    /** The step's supporting line — recovery, reassurance, why a time is a range. '' when it has none. Mealie's `RecipeStep.summary`. */
    summary: text("summary").notNull().default(""),
  },
  (t) => [unique().on(t.partId, t.position)]
);

/**
 * Step-to-ingredient links. Many to many within one part:
 * a step may link any ingredient of its own part, and an ingredient may be
 * linked from several of that part's steps. The pair is the primary key, so a
 * step links a row at most once; `position` is the order the document listed
 * the links in. "Same part" is enforced by `repo.ts` on write — a link across
 * parts is dropped — because no foreign key can state it.
 */
export const stepIngredient = sqliteTable(
  "step_ingredient",
  {
    stepId: text("step_id")
      .notNull()
      .references(() => step.id, { onDelete: "cascade" }),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredient.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (t) => [primaryKey({ columns: [t.stepId, t.ingredientId] }), index("step_ingredient_ingredient_id").on(t.ingredientId)]
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
  (t) => [primaryKey({ columns: [t.recipeId, t.tagId] }), index("recipe_tag_tag_id").on(t.tagId)]
);
