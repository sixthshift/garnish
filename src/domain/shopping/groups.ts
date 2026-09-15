import { formatAmount, formatFood, formatQuantity } from "../ingredient";
import type { Aisle } from "../reference";
import type { ShoppingItem, ShoppingItemSource } from "./schema";

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
