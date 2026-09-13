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
import { convert } from "./convert";
import { formatAmount, formatFood, formatIngredient, formatQuantity } from "./format";
import type { Aisle, Food, Ingredient, Recipe, Unit } from "./recipe";
import { foodSchema, unitSchema } from "./recipe";
import { subRecipeScale, type SubRecipe } from "./subRecipe";

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
// recipe's parts together. A matching food in a *convertible*, not identical,
// unit (M32.2, src/domain/convert.ts) merges too:
//   - into an existing persisted line, the amount is always converted into
//     that line's own unit — a merge can only change a stored line's
//     quantity, never its unit;
//   - between two new additions (no persisted line yet, so no unit to keep
//     stable), the surviving unit is whichever one is metric — the base/target
//     side of the food conversion or unit `standard_*` link that connects
//     them (decisions.md row 69). When neither or both look metric, the
//     earlier addition's unit wins.
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

/** Same unit, or a food conversion / unit standard link connects them (M32.2). */
function unitsConvertible(a: Unit | null, b: Unit | null, food: Food): boolean {
  if (sameUnit(a, b)) return true;
  if (a === null || b === null) return false;
  return convert(1, a, food, b) !== null;
}

/**
 * Whether `unit` is the metric/base side relative to `other`, for this food:
 * either `other`'s own `standard_*` link points at `unit`, or the food has a
 * conversion row whose `toUnitId` is `unit` and whose `unitId` is `other`.
 * Only ever asked of one unit against the other it is merging with, so it
 * never needs a global "is this unit metric" answer.
 */
function isMetricRelativeTo(unit: Unit, other: Unit, food: Food): boolean {
  if (other.standardUnitId === unit.id) return true;
  return food.conversions.some((conversion) => conversion.unitId === other.id && conversion.toUnitId === unit.id);
}

/** Which of two convertible units a merged line should end up in: the metric
 * one when exactly one of them is; `existing`'s otherwise (decisions.md
 * "merge into the metric one", M32.2). */
function preferredUnit(existing: Unit, incoming: Unit, food: Food): Unit {
  const existingMetric = isMetricRelativeTo(existing, incoming, food);
  const incomingMetric = isMetricRelativeTo(incoming, existing, food);
  if (existingMetric === incomingMetric) return existing; // neither or both: keep the existing line's unit
  return existingMetric ? existing : incoming;
}

/** A brand-new line not yet handed to the repository: its draft input, and the
 * `Unit` object it currently carries (the input only keeps the id). */
interface DraftLine {
  input: ShoppingItemInput;
  unit: Unit | null;
}

/**
 * Fold a batch of additions into an existing list. See the module comment
 * above for the rules. Pure; `items` is not mutated.
 */
export function mergeIntoList(items: readonly ShoppingItem[], additions: readonly ShoppingAddition[]): ShoppingMergePlan {
  const merges = new Map<string, ShoppingListMerge>();
  const newLines: DraftLine[] = [];
  const plannedAdditions: ShoppingItemInput[] = [];

  function existingTarget(food: Food, unit: Unit | null) {
    return items.find(
      (item) => !item.ticked && item.food !== null && item.food.id === food.id && unitsConvertible(item.unit, unit, food),
    );
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
        // A merge can only change a stored line's quantity, never its unit,
        // so the amount always lands in the existing line's own unit.
        const inExistingUnit = sameUnit(existing.unit, unit) ? quantity : convert(quantity, unit!, food, existing.unit!)!;
        const entry = merges.get(existing.id);
        if (entry === undefined) {
          merges.set(existing.id, {
            id: existing.id,
            quantity: (existing.quantity ?? 0) + inExistingUnit,
            sources: [{ ...source, quantity }],
          });
        } else {
          entry.quantity = (entry.quantity ?? 0) + inExistingUnit;
          entry.sources.push({ ...source, quantity });
        }
        continue;
      }

      const line = newLines.find((draft) => draft.input.foodId === food.id && unitsConvertible(draft.unit, unit, food));
      if (line === undefined) {
        const created: ShoppingItemInput = {
          quantity,
          unitId: unit?.id ?? null,
          foodId: food.id,
          text: "",
          ticked: false,
          sources: [{ ...source, quantity }],
        };
        newLines.push({ input: created, unit });
        plannedAdditions.push(created);
      } else if (sameUnit(line.unit, unit)) {
        line.input.quantity = (line.input.quantity ?? 0) + quantity;
        line.input.sources!.push({ ...source, quantity });
      } else {
        // Different but convertible units: settle on the metric one, moving
        // the running total across if the draft's own unit loses.
        const winner = preferredUnit(line.unit!, unit!, food);
        if (winner.id === line.unit!.id) {
          line.input.quantity = (line.input.quantity ?? 0) + convert(quantity, unit!, food, winner)!;
        } else {
          const carriedOver = convert(line.input.quantity ?? 0, line.unit!, food, winner)!;
          line.input.quantity = carriedOver + quantity;
          line.input.unitId = winner.id;
          line.unit = winner;
        }
        line.input.sources!.push({ ...source, quantity });
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

// --- Scaling through a sub-recipe ---------------------------------------------
// "The list scales through it" (M32.5): the shopping sheet's per-row "Add
// hollandaise's ingredients instead", offered on a row whose food is made by a
// recipe (M32.3, src/domain/subRecipe.ts). Choosing it swaps that one row for
// the child's own buyable ingredients, scaled to the servings `subRecipeScale`
// derives from the row and the child, with the child stamped as source rather
// than whatever recipe linked to it — the point of the option is that the
// bought line remembers where the amount actually came from.
//
// `childRecipe` is the child's document already brought to that many servings
// (`getRecipe({ slug: child.slug, servings })` scales server-side, same as any
// other read at a servings count). The caller need not fetch it until it knows
// there is a scale to fetch it at: `subRecipeAdditions` reads it only once
// `subRecipeScale` says the two amounts relate, so passing null while nothing
// has been fetched yet is always safe.

/** The line's own text: the original wording, or the formatted line when there is none. Pure. */
function displayText(ingredient: Ingredient): string {
  return ingredient.originalText.trim() || formatIngredient(ingredient).trim();
}

/**
 * One recipe's own buyable ingredients as additions: every part in order, an
 * on-hand food dropped and a food-less row with nothing to say dropped, same
 * as the sheet's own rows follow (`buyable` in
 * src/components/AddToShoppingSheet.tsx). `sourceForPart` builds each row's
 * source from its part's trimmed name — `childIngredientAdditions` (M32.5)
 * uses the child's own part names, and `planWeekAdditions` (M33.3,
 * src/domain/plan.ts) uses one name shared by every row: the plan day rather
 * than the recipe's own part. Pure.
 */
export function recipeAdditions(recipe: Recipe, sourceForPart: (partName: string) => ShoppingAdditionSource): ShoppingAddition[] {
  const additions: ShoppingAddition[] = [];
  for (const part of recipe.parts) {
    const partName = part.name.trim();
    for (const ingredient of part.ingredients) {
      if (ingredient.food !== null && ingredient.food.skipShopping) continue;
      const originalText = displayText(ingredient);
      if (ingredient.food === null && originalText === "") continue;
      additions.push({
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        food: ingredient.food,
        originalText,
        fixed: ingredient.fixed,
        source: sourceForPart(partName),
      });
    }
  }
  return additions;
}

/**
 * The child's own rows as additions, already scaled: `recipeAdditions` with
 * every row stamped with the child recipe as source, its own part names.
 */
function childIngredientAdditions(childRecipe: Recipe): ShoppingAddition[] {
  const servings = childRecipe.recipeServings > 0 ? childRecipe.recipeServings : null;
  return recipeAdditions(childRecipe, (partName) => ({ recipeId: childRecipe.id, recipeName: childRecipe.name, partName, servings }));
}

/**
 * What "Add hollandaise's ingredients instead" contributes: the child's own
 * ingredients (`childIngredientAdditions`) at the servings `subRecipeScale`
 * derives from `ingredient` and `child` — or, when the two amounts cannot be
 * related (no derivable scale, or `childRecipe` not fetched yet), `ingredient`
 * itself as the one line it would have contributed unexpanded, stamped with
 * `parentSource`. Pure.
 */
export function subRecipeAdditions(
  ingredient: Ingredient,
  child: SubRecipe,
  childRecipe: Recipe | null,
  parentSource: ShoppingAdditionSource,
): ShoppingAddition[] {
  const servings = subRecipeScale(ingredient, child);
  if (servings === null || childRecipe === null) {
    return [
      {
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        food: ingredient.food,
        originalText: displayText(ingredient),
        fixed: ingredient.fixed,
        source: parentSource,
      },
    ];
  }
  return childIngredientAdditions(childRecipe);
}

// --- Reading the list --------------------------------------------------------
// What the list page (M31.4) renders, as pure functions over the document so
// the page itself stays a render of them.

/** The heading for lines with no aisle: a food without one, and every free-text line. */
export const UNASSIGNED_GROUP = "Other";
/** The heading for the group ticked lines sink into, at the foot of the list. */
export const TICKED_GROUP = "Ticked";

/** One heading and its lines. `aisle` is null for the unassigned and ticked groups. */
export interface ShoppingAisleGroup {
  /** Stable React key: the aisle's id, or `unassigned` / `ticked`. */
  key: string;
  name: string;
  aisle: Aisle | null;
  /** True for the one group at the foot holding the ticked lines. */
  ticked: boolean;
  items: ShoppingItem[];
}

/** Aisles in `position` order, ties by name, so two aisles at 0 still read stably. Pure. */
function byAisle(a: ShoppingAisleGroup, b: ShoppingAisleGroup): number {
  const left = a.aisle!;
  const right = b.aisle!;
  if (left.position !== right.position) return left.position - right.position;
  return left.name.localeCompare(right.name, "en-AU", { sensitivity: "base" });
}

/**
 * The list as the page draws it: unticked lines grouped by their food's aisle
 * in `aisle.position` order, the ones with no aisle last under "Other", and
 * every ticked line in one "Ticked" group at the foot however it is aisled —
 * a bought line is on its way out of the list, not still to be found in a
 * shop. Lines keep the order they came in (the repository reads by
 * `position`), and an empty group is never returned. Pure.
 */
export function groupByAisle(items: readonly ShoppingItem[]): ShoppingAisleGroup[] {
  const byId = new Map<string, ShoppingAisleGroup>();
  const unassigned: ShoppingItem[] = [];
  const ticked: ShoppingItem[] = [];

  for (const item of items) {
    if (item.ticked) {
      ticked.push(item);
      continue;
    }
    const aisle = item.food?.aisle ?? null;
    if (aisle === null) {
      unassigned.push(item);
      continue;
    }
    const group = byId.get(aisle.id);
    if (group === undefined) byId.set(aisle.id, { key: aisle.id, name: aisle.name, aisle, ticked: false, items: [item] });
    else group.items.push(item);
  }

  const groups = [...byId.values()].sort(byAisle);
  if (unassigned.length > 0) groups.push({ key: "unassigned", name: UNASSIGNED_GROUP, aisle: null, ticked: false, items: unassigned });
  if (ticked.length > 0) groups.push({ key: "ticked", name: TICKED_GROUP, aisle: null, ticked: true, items: ticked });
  return groups;
}

/**
 * A line as one string: "400 g flour" for a food line, the text verbatim for a
 * free-text one. Same rules as `formatIngredient`, minus the note, which a
 * list line does not carry. Pure.
 */
export function shoppingItemLabel(item: Pick<ShoppingItem, "quantity" | "unit" | "food" | "text">): string {
  if (item.food === null) return item.text.trim();
  const amount = item.quantity === null || item.quantity === 0 ? "" : formatAmount(item.quantity, item.unit);
  return [amount, formatFood(item.quantity, item.food)].filter((part) => part !== "").join(" ");
}

/**
 * Where a line came from, for the row's expansion: "Lemon tart, Pastry,
 * serves 4". The part name is dropped for the unnamed part (it is the recipe's
 * main body), the servings when the source did not record them, and a source
 * with no recipe name at all (a hand-typed line) reads as "Added by hand".
 * Pure.
 */
export function sourceLabel(source: Pick<ShoppingItemSource, "recipeName" | "partName" | "servings">): string {
  const parts = [source.recipeName.trim(), source.partName.trim()].filter((part) => part !== "");
  if (parts.length === 0) return "Added by hand";
  const servings = source.servings;
  if (servings !== null && servings > 0) parts.push(`serves ${formatQuantity(servings)}`);
  return parts.join(", ");
}
