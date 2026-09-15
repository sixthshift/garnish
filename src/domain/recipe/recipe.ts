import { z } from "zod";
import { foodSchema, tagSchema, unitSchema } from "../reference";

const id = z.uuid();
const timestamp = z.iso.datetime();
const nonEmpty = z.string().trim().min(1);
const text = z.string().default("");
const minutes = z.number().int().nonnegative().nullable().default(null);
/** Calendar date, YYYY-MM-DD. A cook happened on a day, not at an instant. */
const date = z.iso.date();

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
  /**
   * The ingredients this step uses, in link order. Ids of
   * rows in the step's own part; a link naming anything else is dropped on save.
   */
  ingredientIds: z.array(id).default([]),
  /**
   * The step's photo as a stored file name, served from `/api/images/steps/`
   *. Null is no photo. It rides in the document so a save, which
   * re-inserts every step from it, keeps the photo a step already had.
   */
  image: z.string().nullable().default(null),
};

const noteFields = {
  title: text,
  text,
};

export const ingredientSchema = z.object({ id, ...ingredientFields });
export const stepSchema = z.object({ id, ...stepFields });
export const recipeNoteSchema = z.object({ id, ...noteFields });

const partFields = {
  name: text, // '' is the unnamed part: the flat recipe, or the main body beside named parts
};

export const partSchema = z.object({
  id,
  ...partFields,
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
  parts: z.array(partSchema).min(1, "a recipe needs at least one part"),
  /**
   * When the steps were last rewritten in the house style, or null while they
   * are still the author's words. Read-only: it is not in
   * `recipeFields`, so it is absent from the write shape — the editor never
   * sends it and an ordinary save cannot set or clear it. Only `applyRestyle`
   * and `restoreSteps` move it.
   */
  restyledAt: timestamp.nullable().default(null),
  createdAt: timestamp,
  updatedAt: timestamp,
});

/** List shape: what a recipe card needs, without parts, steps or notes. */
export const recipeSummarySchema = z.object({
  id,
  slug: nonEmpty,
  name: nonEmpty,
  image: z.string().nullable(),
  rating: z.number().min(0).max(5).nullable(),
  prepTime: z.number().int().nonnegative().nullable(),
  performTime: z.number().int().nonnegative().nullable(),
  /** prepTime + performTime; null when neither is recorded. See domain/ingredient/format.ts's totalMinutes. */
  totalTime: z.number().int().nonnegative().nullable(),
  lastMade: timestamp.nullable(),
  favourite: z.boolean(),
  tags: z.array(tagSchema),
  /** First six ingredient lines, part order then row order, formatted with domain/ingredient/format.ts's formatIngredient. */
  ingredientPreview: z.array(z.string()),
});

/** One logged cook: "Made this" on a date, with an optional note and photo. */
export const timelineEventSchema = z.object({
  id,
  recipeId: id,
  occurredOn: date,
  message: text,
  image: z.string().nullable().default(null),
  /** Servings the cook was made at, or null when not recorded. */
  servings: z.number().positive().nullable().default(null),
  createdAt: timestamp,
});

/** What a caller sends to log a cook; the recipe comes from the route. */
export const timelineEventInputSchema = z.object({
  occurredOn: date,
  message: text,
  image: z.string().nullable().default(null),
  servings: z.number().positive().nullable().default(null),
});

// --- Write shape ------------------------------------------------------------
// Same document without slug and timestamps (server-generated) and with child
// ids optional, so a create can omit them and an update can keep them.

const optionalId = { id: id.optional() };

export const ingredientInputSchema = z.object({ ...optionalId, ...ingredientFields });
export const stepInputSchema = z.object({ ...optionalId, ...stepFields });
export const recipeNoteInputSchema = z.object({ ...optionalId, ...noteFields });

export const partInputSchema = z.object({
  ...optionalId,
  ...partFields,
  ingredients: z.array(ingredientInputSchema).default([]),
  steps: z.array(stepInputSchema).default([]),
});

export const recipeInputSchema = z.object({
  ...optionalId,
  ...recipeFields,
  notes: z.array(recipeNoteInputSchema).default([]),
  parts: z.array(partInputSchema).min(1, "a recipe needs at least one part"),
});

// --- Types ------------------------------------------------------------------

export type Ingredient = z.infer<typeof ingredientSchema>;
export type Step = z.infer<typeof stepSchema>;
export type RecipeNote = z.infer<typeof recipeNoteSchema>;
export type Part = z.infer<typeof partSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type RecipeSummary = z.infer<typeof recipeSummarySchema>;
export type TimelineEvent = z.infer<typeof timelineEventSchema>;
export type TimelineEventInput = z.infer<typeof timelineEventInputSchema>;

/** What a caller sends to create or replace a recipe. Defaults not yet applied. */
export type RecipeInput = z.input<typeof recipeInputSchema>;
/** A parsed RecipeInput: defaults applied, ready for the repository. */
export type ParsedRecipeInput = z.infer<typeof recipeInputSchema>;
