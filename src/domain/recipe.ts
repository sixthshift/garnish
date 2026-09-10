// Recipe document: the full nested shape the API reads and writes.
// Pure: no IO, no bun:sqlite. Importable by the client.
//
// Mirrors src/db/migrations/001_init.sql column for column in camelCase,
// with Mealie's field names where Mealie has the concept:
//   servings        -> recipeServings
//   yield_quantity  -> recipeYieldQuantity
//   yield_text      -> recipeYield         (decisions.md row 20)
//   prep_minutes    -> prepTime            integer minutes, not Mealie's free text
//   cook_minutes    -> performTime         integer minutes, not Mealie's free text
// Shape decisions:
//   - Array order is `position`. The document carries no position fields; the
//     repository writes them from array index and reads them back in order.
//   - Foreign keys (unit_id, food_id, yield_unit_id, tag_id) are nested
//     reference objects, as in Mealie. Writes use only the nested `id`.
//   - Steps belong to the recipe. A step whose component_id is set nests under
//     that component's `steps`; steps with a null component_id live in the
//     recipe-level `steps` array. Recipe position is component order first,
//     then recipe-level steps.
//   - Parent ids (recipe_id, component_id) are implied by nesting and omitted.
import { z } from "zod";

const id = z.uuid();
const timestamp = z.iso.datetime();
const nonEmpty = z.string().trim().min(1);
const text = z.string().default("");
const minutes = z.number().int().nonnegative().nullable().default(null);
/** Calendar date, YYYY-MM-DD. A cook happened on a day, not at an instant. */
const date = z.iso.date();

// --- Reference tables -------------------------------------------------------

export const aisleSchema = z.object({
  id,
  name: nonEmpty,
  position: z.number().int().nonnegative().default(0),
});

export const unitSchema = z.object({
  id,
  name: nonEmpty,
  pluralName: z.string().nullable().default(null),
  abbreviation: text,
  useAbbreviation: z.boolean().default(false),
  fraction: z.boolean().default(true),
  standardQuantity: z.number().nonnegative().nullable().default(null),
  standardUnitId: id.nullable().default(null),
});

export const foodSchema = z.object({
  id,
  name: nonEmpty,
  pluralName: z.string().nullable().default(null),
  aliases: z.array(z.string()).default([]),
  aisle: aisleSchema.nullable().default(null),
  recipeId: id.nullable().default(null), // sub-recipe hook, behaviour deferred
  skipShopping: z.boolean().default(false),
});

export const tagSchema = z.object({
  id,
  name: nonEmpty,
  slug: nonEmpty,
});

// --- Recipe-owned rows ------------------------------------------------------

const ingredientFields = {
  quantity: z.number().nonnegative().nullable().default(null), // null: no amount ("salt to taste")
  unit: unitSchema.nullable().default(null),
  food: foodSchema.nullable().default(null),
  note: text,
  originalText: text,
  fixed: z.boolean().default(false), // has an amount, does not scale (Cooklang `=`)
};

const stepFields = {
  text,
};

const noteFields = {
  title: text,
  text,
};

export const ingredientSchema = z.object({ id, ...ingredientFields });
export const stepSchema = z.object({ id, ...stepFields });
export const recipeNoteSchema = z.object({ id, ...noteFields });

const componentFields = {
  name: text, // '' is the single unnamed component (flat recipe)
};

export const componentSchema = z.object({
  id,
  ...componentFields,
  ingredients: z.array(ingredientSchema).default([]),
  steps: z.array(stepSchema).default([]),
});

const recipeFields = {
  name: nonEmpty,
  description: text,
  image: z.string().nullable().default(null),
  rating: z.number().min(0).max(5).nullable().default(null),
  lastMade: timestamp.nullable().default(null),
  recipeServings: z.number().nonnegative().default(0),
  recipeYieldQuantity: z.number().nonnegative().default(0),
  yieldUnit: unitSchema.nullable().default(null),
  recipeYield: text,
  prepTime: minutes,
  performTime: minutes,
  sourceUrl: z.string().nullable().default(null),
  favourite: z.boolean().default(false),
  notes: z.array(recipeNoteSchema).default([]),
  tags: z.array(tagSchema).default([]),
};

/** Read shape: every row has an id, the recipe has slug and timestamps. */
export const recipeSchema = z.object({
  id,
  slug: nonEmpty,
  ...recipeFields,
  components: z.array(componentSchema).min(1, "a recipe needs at least one component"),
  steps: z.array(stepSchema).default([]),
  createdAt: timestamp,
  updatedAt: timestamp,
});

/** List shape: what a recipe card needs, without components, steps or notes. */
export const recipeSummarySchema = z.object({
  id,
  slug: nonEmpty,
  name: nonEmpty,
  image: z.string().nullable(),
  rating: z.number().min(0).max(5).nullable(),
  prepTime: z.number().int().nonnegative().nullable(),
  performTime: z.number().int().nonnegative().nullable(),
  /** prepTime + performTime; null when neither is recorded. See domain/format.ts's totalMinutes. */
  totalTime: z.number().int().nonnegative().nullable(),
  lastMade: timestamp.nullable(),
  favourite: z.boolean(),
  tags: z.array(tagSchema),
});

/** One logged cook: "Made this" on a date, with an optional note and photo. */
export const timelineEventSchema = z.object({
  id,
  recipeId: id,
  occurredOn: date,
  message: text,
  image: z.string().nullable().default(null),
  createdAt: timestamp,
});

/** What a caller sends to log a cook; the recipe comes from the route. */
export const timelineEventInputSchema = z.object({
  occurredOn: date,
  message: text,
  image: z.string().nullable().default(null),
});

// --- Write shape ------------------------------------------------------------
// Same document without slug and timestamps (server-generated) and with child
// ids optional, so a create can omit them and an update can keep them.

const optionalId = { id: id.optional() };

export const ingredientInputSchema = z.object({ ...optionalId, ...ingredientFields });
export const stepInputSchema = z.object({ ...optionalId, ...stepFields });
export const recipeNoteInputSchema = z.object({ ...optionalId, ...noteFields });

export const componentInputSchema = z.object({
  ...optionalId,
  ...componentFields,
  ingredients: z.array(ingredientInputSchema).default([]),
  steps: z.array(stepInputSchema).default([]),
});

export const recipeInputSchema = z.object({
  ...optionalId,
  ...recipeFields,
  notes: z.array(recipeNoteInputSchema).default([]),
  components: z.array(componentInputSchema).min(1, "a recipe needs at least one component"),
  steps: z.array(stepInputSchema).default([]),
});

// --- Types ------------------------------------------------------------------

export type Aisle = z.infer<typeof aisleSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type Food = z.infer<typeof foodSchema>;
export type Tag = z.infer<typeof tagSchema>;
export type Ingredient = z.infer<typeof ingredientSchema>;
export type Step = z.infer<typeof stepSchema>;
export type RecipeNote = z.infer<typeof recipeNoteSchema>;
export type Component = z.infer<typeof componentSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type RecipeSummary = z.infer<typeof recipeSummarySchema>;
export type TimelineEvent = z.infer<typeof timelineEventSchema>;
export type TimelineEventInput = z.infer<typeof timelineEventInputSchema>;

/** What a caller sends to create or replace a recipe. Defaults not yet applied. */
export type RecipeInput = z.input<typeof recipeInputSchema>;
/** A parsed RecipeInput: defaults applied, ready for the repository. */
export type ParsedRecipeInput = z.infer<typeof recipeInputSchema>;
