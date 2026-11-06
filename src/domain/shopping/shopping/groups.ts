import { formatAmount, formatIngredient } from "../../recipes/ingredient";
import { type Aisle, convert, type Unit } from "../../recipes/reference";
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

// --- Meals ------------------------------------------------------------------
// Which dish asked for what (decisions.md rows 182 and 183), so a week's shop
// can be read as what is for what: under each line, the dishes it is for; and
// the list's dishes as a desktop's meals key and a phone's chips, which light
// or narrow the list to one dish's lines (rows 207 and 208; the phone's own
// meal view, row 182's, gave way to the chips). A dish is a recipe on a plan
// day — the same recipe on Monday and Thursday is two dishes — or, when the
// recipe came from its own page, the recipe alone.

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

/** One dish a line is for: the recipe, the day the plan asked for it, and its share when the line is shared. */
export interface ShoppingMeal {
  name: string;
  date: string | null;
  /** The live recipe's slug, for a link to it; null once the recipe is gone. */
  slug: string | null;
  /** This dish's amount ("200 g") when the line is shared with another dish; '' when it is the only one, or the amount cannot be said. */
  amount: string;
}

/**
 * The dishes a line is for, for the second line under it: each once, in the
 * order they reached the line (decisions.md row 183), each with its recipe's slug for a link and, on a
 * line two dishes share, its own amount (row 187): "Lemon tart 200 g · Roast
 * chicken 150 g". A hand-typed line or a plain plan entry is for no dish and
 * gives none. Pure.
 */
export function mealsOf(item: ShoppingItem): ShoppingMeal[] {
  const byKey = new Map<string, ShoppingItemSource[]>();
  for (const source of item.sources) {
    const key = mealKey(source);
    if (key !== NO_MEAL_KEY) byKey.set(key, [...(byKey.get(key) ?? []), source]);
  }
  const shared = byKey.size > 1;
  return [...byKey.values()].map((sources) => {
    const first = sources[0]!;
    const share = shared ? shareOf(item, sources) : null;
    return {
      name: first.recipeName.trim(),
      date: first.planDate,
      slug: sources.find((source) => source.recipeSlug !== null)?.recipeSlug ?? null,
      amount: share === null ? "" : formatAmount(share.quantity, share.unit),
    };
  });
}

/**
 * Which dishes a line is for, as keys: the ones `shoppingMeals` gives each
 * dish, so a desktop's meals key can light the lines of the dish it points at
 * and a phone's chips narrow the list to them. A hand-typed line is for none.
 * Pure.
 */
export function mealKeysOf(item: Pick<ShoppingItem, "sources">): string[] {
  return [...new Set(item.sources.map(mealKey))].filter((key) => key !== NO_MEAL_KEY);
}

/** One dish the list is for, as a desktop's meals key and a phone's chips show it. */
export interface ShoppingListMeal {
  /** What `mealKeysOf` calls it. */
  key: string;
  name: string;
  /** The plan day that asked for it, YYYY-MM-DD; null for a recipe added from its own page. */
  date: string | null;
  /** The live recipe's slug and photo; null once the recipe is gone, and the photo null when it has none. */
  slug: string | null;
  image: string | null;
  /** Its lines still to buy, and all of them. */
  left: number;
  total: number;
}

/**
 * The dishes the list is for, the plan's by day, then recipes added from
 * their own page, each with how many of its lines are still to buy: the
 * desktop's meals key and the phone's chips. A line two dishes share counts
 * for both; lines no dish asked for are no dish's. Pure.
 */
export function shoppingMeals(items: readonly ShoppingItem[]): ShoppingListMeal[] {
  const meals = new Map<string, ShoppingListMeal>();
  for (const item of items) {
    for (const source of item.sources) {
      const key = mealKey(source);
      if (key === NO_MEAL_KEY) continue;
      let meal = meals.get(key);
      if (meal === undefined) {
        meal = { key, name: source.recipeName.trim(), date: source.planDate, slug: null, image: null, left: 0, total: 0 };
        meals.set(key, meal);
      }
      meal.slug ??= source.recipeSlug;
      meal.image ??= source.recipeImage;
    }
    for (const key of mealKeysOf(item)) {
      const meal = meals.get(key)!;
      meal.total += 1;
      if (!item.ticked) meal.left += 1;
    }
  }
  const rank = (meal: ShoppingListMeal) => (meal.date === null ? 1 : 0);
  return [...meals.values()].sort((a, b) => rank(a) - rank(b) || (a.date !== null && b.date !== null ? a.date.localeCompare(b.date) : 0));
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
