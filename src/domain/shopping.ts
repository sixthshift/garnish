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
import type { Food, Unit } from "./recipe";
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

// --- Merging into the list ---------------------------------------------------
// mergeIntoList(items, additions): where an "Add to shopping list" tap (M31.3)
// or a week added from the plan (M33.3) lands. Reuses src/domain/merge.ts's
// rule that a `fixed` or null-quantity ingredient never merges (decisions.md
// row 13), plus three rules of its own that mergeIngredients has no reason to
// know about, because they are about the *list*, not a single recipe:
//   - an unticked line is fair game to absorb an addition; a ticked one is
//     left alone (it is on its way out of the list, or already bought) and
//     the addition gets a new line instead;
//   - a `skipShopping` food (garlic, salt — already on hand) is dropped
//     rather than ever appearing on the list;
//   - a food-less addition (free text, or an ingredient whose parser found no
//     food) always becomes its own new free-text line: unlike mergeIngredients,
//     which merges identical unparsed lines by their raw text within one
//     recipe, two food-less additions here never combine, because the list
//     mixes text from unrelated sources and identical wording is coincidence.
// Additions with a matching food and unit still merge with each other and with
// the existing list in one pass, the same way mergeIngredients folds a
// recipe's parts together.
//
// Pure: no ids or timestamps are minted here. The result is a plan the caller
// hands to the repository — `merges` for existing lines (new total quantity,
// sources to append) and `additions` as `ShoppingItemInput`s ready for
// `addShoppingItems`, which already knows how to store more than one source.

/** Where an addition came from, minus the amount — `mergeIntoList` fills that in per source. */
export type ShoppingAdditionSource = Omit<ShoppingItemSourceInput, "quantity">;

/**
 * One line coming in: a recipe ingredient (scaled, with its food and unit
 * resolved) or a plain line of text, plus where it came from. Shaped like
 * `Ingredient` (src/domain/recipe.ts) rather than importing it, so a caller
 * building additions from something other than a recipe isn't forced through
 * that type.
 */
export interface ShoppingAddition {
  quantity: number | null;
  unit: Unit | null;
  food: Food | null;
  originalText: string;
  fixed: boolean;
  source: ShoppingAdditionSource;
}

/** An existing line absorbing one or more additions: its new total and the sources to append. */
export interface ShoppingListMerge {
  id: string;
  quantity: number | null;
  sources: ShoppingItemSourceInput[];
}

/** What `mergeIntoList` found to do with a batch of additions. */
export interface ShoppingMergePlan {
  merges: ShoppingListMerge[];
  additions: ShoppingItemInput[];
}

function sameUnit(a: Unit | null, b: Unit | null): boolean {
  return (a?.id ?? null) === (b?.id ?? null);
}

/** A food+unit key an addition merges under; unit-less is its own bucket. */
function foodUnitKey(food: Food, unit: Unit | null): string {
  return `${food.id}|${unit?.id ?? ""}`;
}

/**
 * Fold a batch of additions into an existing list. See the module comment
 * above for the rules. Pure; `items` is not mutated.
 */
export function mergeIntoList(items: readonly ShoppingItem[], additions: readonly ShoppingAddition[]): ShoppingMergePlan {
  const merges = new Map<string, ShoppingListMerge>();
  const newLines = new Map<string, ShoppingItemInput>();
  const plannedAdditions: ShoppingItemInput[] = [];

  function existingTarget(food: Food, unit: Unit | null) {
    return items.find((item) => !item.ticked && item.food !== null && item.food.id === food.id && sameUnit(item.unit, unit));
  }

  for (const addition of additions) {
    const { quantity, unit, food, originalText, fixed, source } = addition;

    if (food !== null && food.skipShopping) continue; // on hand already: dropped

    if (food === null) {
      // Free text, or an ingredient the parser found no food for: its own new
      // line every time, never merged with anything else.
      plannedAdditions.push({
        quantity: null,
        unitId: null,
        foodId: null,
        text: originalText,
        ticked: false,
        sources: [{ ...source, quantity: null }],
      });
      continue;
    }

    const mergeable = !fixed && quantity !== null;

    if (mergeable) {
      const existing = existingTarget(food, unit);
      if (existing !== undefined) {
        const entry = merges.get(existing.id);
        if (entry === undefined) {
          merges.set(existing.id, {
            id: existing.id,
            quantity: (existing.quantity ?? 0) + quantity,
            sources: [{ ...source, quantity }],
          });
        } else {
          entry.quantity = (entry.quantity ?? 0) + quantity;
          entry.sources.push({ ...source, quantity });
        }
        continue;
      }

      const key = foodUnitKey(food, unit);
      const line = newLines.get(key);
      if (line === undefined) {
        const created: ShoppingItemInput = {
          quantity,
          unitId: unit?.id ?? null,
          foodId: food.id,
          text: "",
          ticked: false,
          sources: [{ ...source, quantity }],
        };
        newLines.set(key, created);
        plannedAdditions.push(created);
      } else {
        line.quantity = (line.quantity ?? 0) + quantity;
        line.sources!.push({ ...source, quantity });
      }
      continue;
    }

    // `fixed` or a null quantity: its own line, same as mergeIngredients.
    plannedAdditions.push({
      quantity,
      unitId: unit?.id ?? null,
      foodId: food.id,
      text: "",
      ticked: false,
      sources: [{ ...source, quantity }],
    });
  }

  return { merges: [...merges.values()], additions: plannedAdditions };
}
