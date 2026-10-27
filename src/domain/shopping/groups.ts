import { formatIngredient, formatQuantity } from "../ingredient";
import { type Aisle, convert, type Unit } from "../reference";
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

// --- By meal ----------------------------------------------------------------
// The list's second view (decisions.md row 182): the same lines under the
// dish that asked for them, so a week's shop can be read as what is for what.
// A dish is a recipe on a plan day — the same recipe on Monday and Thursday is
// two dishes — or, when the recipe came from its own page, the recipe alone.
// A line two dishes share sits under both, each showing its own share of it;
// it is still one line, and a tick on either is a tick on it.

/** The heading for lines no dish asked for: typed by hand, or a plain-text plan entry. */
export const NO_MEAL_GROUP = "Other";

/** One line under one dish: the line, and what to call it there. */
export interface ShoppingMealRow {
  item: ShoppingItem;
  /** This dish's share ("200 g butter"), or the whole line when the dish is all of it or the share cannot be said. */
  label: string;
  /** The whole line ("350 g butter") when `label` is only a share of it; null otherwise. */
  whole: string | null;
}

/** One dish and its lines. */
export interface ShoppingMealGroup {
  /** Stable React key: the recipe and the day, or `other`. */
  key: string;
  /** The recipe's name, or "Other". */
  name: string;
  /** The live recipe, while there is one. */
  recipeId: string | null;
  /** The plan day that asked for it, YYYY-MM-DD; null for a recipe added from its own page, and for "Other". */
  date: string | null;
  rows: ShoppingMealRow[];
}

const NO_MEAL_KEY = "other";

/** Which dish a source belongs to: the recipe (by id while it lives, by name after) on its plan day. */
function mealKey(source: ShoppingItemSource): string {
  if (source.recipeName.trim() === "") return NO_MEAL_KEY;
  return `${source.recipeId ?? `name:${source.recipeName}`}@${source.planDate ?? ""}`;
}

/**
 * What `sources` contributed to `item`, in one unit: their unit when they
 * share one, else the line's own through the food's conversions. Null when it
 * cannot be said — an amount missing, or a unit with no way to the line's.
 */
function shareOf(item: ShoppingItem, sources: readonly ShoppingItemSource[]): { quantity: number; unit: Unit | null } | null {
  const food = item.food;
  if (food === null) return null;
  // A source written before it kept its unit, or one that arrived unitless, is in the line's own.
  const parts = sources.map((source) => ({ quantity: source.quantity, unit: source.unit ?? item.unit }));
  if (parts.some((part) => part.quantity === null)) return null;
  const first = parts[0]!.unit;
  if (parts.every((part) => (part.unit?.id ?? null) === (first?.id ?? null))) {
    return { quantity: parts.reduce((sum, part) => sum + part.quantity!, 0), unit: first };
  }
  const target = item.unit;
  if (target === null) return null;
  let total = 0;
  for (const part of parts) {
    const converted = part.unit === null ? null : part.unit.id === target.id ? part.quantity : convert(part.quantity!, part.unit, food, target);
    if (converted === null) return null;
    total += converted;
  }
  return { quantity: total, unit: target };
}

/** `item` as `sources` see it: the whole line when they are all of it, their share when they are not. */
function mealRow(item: ShoppingItem, sources: readonly ShoppingItemSource[]): ShoppingMealRow {
  const whole = shoppingItemLabel(item);
  if (sources.length === item.sources.length) return { item, label: whole, whole: null };
  const share = shareOf(item, sources);
  if (share === null) return { item, label: whole, whole: null };
  const label = shoppingItemLabel({ quantity: share.quantity, unit: share.unit, food: item.food, text: "" });
  return label === whole ? { item, label, whole: null } : { item, label, whole };
}

/** One dish a line is for: the recipe's name and, when the plan asked for it, the day. */
export interface ShoppingMeal {
  name: string;
  date: string | null;
}

/**
 * The dishes a line is for, for the aisle view's second line under it: each
 * once, in the order they reached the line, as the meal view would group them
 * (decisions.md row 183). A hand-typed line or a plain plan entry is for no
 * dish and gives none. Pure.
 */
export function mealsOf(item: Pick<ShoppingItem, "sources">): ShoppingMeal[] {
  const meals = new Map<string, ShoppingMeal>();
  for (const source of item.sources) {
    const key = mealKey(source);
    if (key === NO_MEAL_KEY || meals.has(key)) continue;
    meals.set(key, { name: source.recipeName.trim(), date: source.planDate });
  }
  return [...meals.values()];
}

/**
 * The list as the meal view draws it: one group per dish, the plan's dishes
 * first in day order, then recipes added from their own page in the order
 * they reached the list, then "Other" for every line no dish asked for. A
 * line two dishes share is a row under each, with that dish's share; ticked
 * lines stay where they are, since the view is for seeing how far along each
 * dish is. Lines keep the list's order within a group, and an empty group is
 * never returned. Pure.
 */
export function groupByMeal(items: readonly ShoppingItem[]): ShoppingMealGroup[] {
  const groups = new Map<string, ShoppingMealGroup>();

  for (const item of items) {
    const byKey = new Map<string, ShoppingItemSource[]>();
    for (const source of item.sources) {
      const key = mealKey(source);
      byKey.set(key, [...(byKey.get(key) ?? []), source]);
    }
    if (byKey.size === 0) byKey.set(NO_MEAL_KEY, []);

    for (const [key, sources] of byKey) {
      let group = groups.get(key);
      if (group === undefined) {
        const source = sources[0];
        group =
          key === NO_MEAL_KEY || source === undefined
            ? { key, name: NO_MEAL_GROUP, recipeId: null, date: null, rows: [] }
            : { key, name: source.recipeName.trim(), recipeId: source.recipeId, date: source.planDate, rows: [] };
        groups.set(key, group);
      }
      group.rows.push(key === NO_MEAL_KEY ? { item, label: shoppingItemLabel(item), whole: null } : mealRow(item, sources));
    }
  }

  // Dated dishes by day (a stable sort keeps two on one day in list order), undated after, "Other" last.
  const rank = (group: ShoppingMealGroup) => (group.key === NO_MEAL_KEY ? 2 : group.date === null ? 1 : 0);
  return [...groups.values()].sort((a, b) => rank(a) - rank(b) || (a.date !== null && b.date !== null ? a.date.localeCompare(b.date) : 0));
}

/**
 * A line as one string: "400 g flour" for a food line, the text verbatim for a
 * free-text one. Same rules as `formatIngredient`, minus the note, which a
 * list line does not carry. Pure.
 */
export function shoppingItemLabel(item: Pick<ShoppingItem, "quantity" | "unit" | "food" | "text">): string {
  if (item.food === null) return item.text.trim();
  return formatIngredient({ quantity: item.quantity, unit: item.unit, food: item.food, note: "", originalText: "" });
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
