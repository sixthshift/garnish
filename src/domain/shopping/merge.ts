// The list's merge rule: by food and unit (or a convertible unit) into an unticked line; on-hand foods dropped; food-less additions never combine.

import { convert, type Food, type Unit } from "../reference";
import type { ShoppingItem, ShoppingItemInput, ShoppingItemSourceInput } from "./schema";

/** Where an addition came from, minus the amount — `mergeIntoList` fills that in per source. */
export type ShoppingAdditionSource = Omit<ShoppingItemSourceInput, "quantity">;

/**
 * One line coming in: a recipe ingredient (scaled, with its food and unit
 * resolved) or a plain line of text, plus where it came from. Shaped like
 * `Ingredient` (src/domain/recipe/recipe.ts) rather than importing it, so a caller
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

/** Same unit, or a food conversion / unit standard link connects them. */
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
 * one when exactly one of them is; `existing`'s otherwise. */
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
 * Fold a batch of additions into an existing list. A `fixed` or null-quantity
 * addition never merges; a ticked line is never merged into; a convertible
 * unit lands in the stored line's own unit, and between two new lines the
 * metric one wins. Pure; `items` is not mutated.
 */
export function mergeIntoList(items: readonly ShoppingItem[], additions: readonly ShoppingAddition[]): ShoppingMergePlan {
  const merges = new Map<string, ShoppingListMerge>();
  const newLines: DraftLine[] = [];
  const plannedAdditions: ShoppingItemInput[] = [];

  function existingTarget(food: Food, unit: Unit | null) {
    return items.find((item) => !item.ticked && item.food !== null && item.food.id === food.id && unitsConvertible(item.unit, unit, food));
  }

  for (const addition of additions) {
    const { quantity, unit, food, originalText, fixed, source } = addition;

    if (food?.skipShopping) continue; // on hand already: dropped

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
