// Shopping list document: the shape the API reads and writes for the one
// household list (decisions.md row 67). Pure: no IO, no bun:sqlite.
// Importable by the client.
//
// Mirrors src/db/migrations/005_shopping.sql column for column in camelCase,
// with the same conventions the recipe document follows:
//   - Array order is `position`; the read document keeps `position` because the
//     list is one flat draggable list rather than a nested tree, and the page
//     groups it by aisle without losing the stored order.
//   - Foreign keys come back as nested objects (`food`, `unit`), reusing the
//     recipe document's `foodSchema` and `unitSchema` — the food carries its
//     aisle, which is what the list groups by.
//   - Writes send ids (`foodId`, `unitId`, `sources[].recipeId`), never nested
//     objects: everything a line can point at already exists by the time it is
//     added, so the list never creates reference rows the way a recipe save does.
//   - `sources` is nested under its line: where the line came from, kept as
//     copied names so it survives the recipe being deleted (M31.1).
import { z } from "zod";
import { foodSchema, unitSchema } from "./recipe";

const id = z.uuid();
const timestamp = z.iso.datetime();
const text = z.string().default("");
const quantity = z.number().nonnegative().nullable().default(null);

/**
 * Where a line came from: "Lemon tart, Pastry, serves 4". `recipeName` and
 * `partName` are copies rather than joins, so the answer outlives the recipe;
 * `recipeId` is the live link while there is one, and goes null with the recipe.
 */
export const shoppingItemSourceSchema = z.object({
  id,
  recipeId: id.nullable().default(null),
  recipeName: text,
  partName: text, // '' is the unnamed part: the recipe's main body
  servings: quantity, // the scale the recipe was added at
  quantity, // what this source contributed to the line
});

/** One line of the list: a food line (`food` set) or a free-text line (`text`). */
export const shoppingItemSchema = z.object({
  id,
  position: z.number().int().nonnegative(),
  quantity, // null: no amount ("olive oil")
  unit: unitSchema.nullable().default(null),
  food: foodSchema.nullable().default(null),
  text, // the whole line when there is no food; '' on a food line
  ticked: z.boolean().default(false),
  createdAt: timestamp,
  updatedAt: timestamp,
  sources: z.array(shoppingItemSourceSchema).default([]),
});

// --- Write shape ------------------------------------------------------------
// Ids and timestamps are server-generated, `position` is the end of the list,
// and references are ids.

/** One source as a caller sends it. */
export const shoppingItemSourceInputSchema = z.object({
  recipeId: id.nullable().default(null),
  recipeName: text,
  partName: text,
  servings: quantity,
  quantity,
});

/** One line as a caller sends it. A line with neither a food nor text is rejected. */
export const shoppingItemInputSchema = z
  .object({
    quantity,
    unitId: id.nullable().default(null),
    foodId: id.nullable().default(null),
    text,
    ticked: z.boolean().default(false),
    sources: z.array(shoppingItemSourceInputSchema).default([]),
  })
  .refine((item) => item.foodId !== null || item.text.trim() !== "", {
    message: "a line needs a food or some text",
  });

/** A patch over an existing line. Absent fields are left alone. */
export const shoppingItemPatchSchema = z.object({
  quantity: z.number().nonnegative().nullable().optional(),
  unitId: id.nullable().optional(),
  foodId: id.nullable().optional(),
  text: z.string().optional(),
  ticked: z.boolean().optional(),
});

// --- Types ------------------------------------------------------------------

export type ShoppingItemSource = z.infer<typeof shoppingItemSourceSchema>;
export type ShoppingItem = z.infer<typeof shoppingItemSchema>;
export type ShoppingItemSourceInput = z.infer<typeof shoppingItemSourceInputSchema>;
/** What a caller sends to add a line. Defaults not yet applied. */
export type ShoppingItemInput = z.input<typeof shoppingItemInputSchema>;
/** A parsed ShoppingItemInput: defaults applied, ready for the repository. */
export type ParsedShoppingItemInput = z.infer<typeof shoppingItemInputSchema>;
export type ShoppingItemPatch = z.infer<typeof shoppingItemPatchSchema>;
