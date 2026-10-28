import { draftFromRecipe, type RecipeDraft } from "../../../../../domain/draft";
import { formatAmount } from "../../../../../domain/ingredient";
import type { Ingredient, Recipe } from "../../../../../domain/recipe";
import type { StorageLike } from "../../../../../lib/ticks";

// What changed at the stove (decisions.md row 193). A cook changes an amount
// or rewrites a step as they go; the deck shows the change at once, and the
// finish card asks of each whether it goes into the recipe or was just this
// time. Pure, apart from the session storage that carries the changes across
// a reload.

/**
 * One change. `quantity` is at the recipe's stored servings, so it applies to
 * the document whatever the deck was scaled to; `before` and `after` are what
 * the cook saw and typed, at the deck's servings, which is how the finish card
 * says it.
 */
export type CookChange =
  | { kind: "amount"; ingredientId: string; quantity: number; label: string; before: string; after: string }
  | { kind: "step"; stepId: string; position: number; text: string };

export type ChangeDecision = "keep" | "once";

/** A change's identity: one per ingredient, one per step, the latest winning. */
export const changeKey = (change: CookChange): string => (change.kind === "amount" ? `amount:${change.ingredientId}` : `step:${change.stepId}`);

/**
 * `changes` with `change` in it, replacing an earlier change to the same row.
 * A second change to an amount keeps the first one's `before`, so the finish
 * card says what the recipe had; changed back to that, the change goes.
 */
export function withChange(changes: readonly CookChange[], change: CookChange): CookChange[] {
  const key = changeKey(change);
  const earlier = changes.find((existing) => changeKey(existing) === key);
  const rest = changes.filter((existing) => changeKey(existing) !== key);
  if (change.kind === "amount" && earlier?.kind === "amount") {
    if (change.after === earlier.before) return rest;
    return [...rest, { ...change, before: earlier.before }];
  }
  return [...rest, change];
}

/** `changes` without the one to the row `key` names. */
export function withoutChange(changes: readonly CookChange[], key: string): CookChange[] {
  return changes.filter((existing) => changeKey(existing) !== key);
}

/** What a change reads as on the finish card. */
export function describeChange(change: CookChange): string {
  return change.kind === "amount" ? `${change.label}: ${change.before} → ${change.after}` : `Step ${change.position} rewritten`;
}

/** A row's name for a change: its food, else its own words. */
function ingredientLabel(ingredient: Ingredient): string {
  const name = ingredient.food?.name ?? ingredient.originalText;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * The change a cook makes typing `typed` over `shown` (the row as the deck
 * drew it, scaled by `factor`, the deck's servings over the stored ones). A
 * fixed amount does not scale, so it is stored as typed. Null when the typed
 * amount is not a positive number or is what was shown.
 */
export function amountChange(shown: Ingredient, typed: number, factor: number): CookChange | null {
  if (!(typed > 0) || !Number.isFinite(typed) || shown.quantity === null) return null;
  if (Math.abs(typed - shown.quantity) < 1e-9) return null;
  const quantity = shown.fixed || !(factor > 0) ? typed : typed / factor;
  return {
    kind: "amount",
    ingredientId: shown.id,
    quantity,
    label: ingredientLabel(shown),
    before: formatAmount(shown.quantity, shown.unit),
    after: formatAmount(typed, shown.unit),
  };
}

/** The stored recipe with every change in it: what the deck is built from, before scaling. */
export function withChanges(recipe: Recipe, changes: readonly CookChange[]): Recipe {
  if (changes.length === 0) return recipe;
  const amounts = new Map(changes.flatMap((change) => (change.kind === "amount" ? [[change.ingredientId, change.quantity] as const] : [])));
  const steps = new Map(changes.flatMap((change) => (change.kind === "step" ? [[change.stepId, change.text] as const] : [])));
  return {
    ...recipe,
    parts: recipe.parts.map((part) => ({
      ...part,
      ingredients: part.ingredients.map((ingredient) => {
        const quantity = amounts.get(ingredient.id);
        return quantity === undefined ? ingredient : { ...ingredient, quantity };
      }),
      steps: part.steps.map((step) => {
        const text = steps.get(step.id);
        return text === undefined ? step : { ...step, text };
      }),
    })),
  };
}

/** The changes a decision map keeps: every one not marked "once". */
export function keptChanges(changes: readonly CookChange[], decisions: Readonly<Record<string, ChangeDecision>>): CookChange[] {
  return changes.filter((change) => decisions[changeKey(change)] !== "once");
}

/** The stored recipe as a draft with the kept changes written in, for the quick edit's save. */
export function keptDraft(recipe: Recipe, kept: readonly CookChange[]): RecipeDraft {
  return draftFromRecipe(withChanges(recipe, kept));
}

/** The changes marked "once", as the line the cook log's comment starts with. Empty when there are none. */
export function onceNote(changes: readonly CookChange[], decisions: Readonly<Record<string, ChangeDecision>>): string {
  const once = changes.filter((change) => decisions[changeKey(change)] === "once");
  if (once.length === 0) return "";
  return `This time: ${once.map((change) => (change.kind === "amount" ? describeChange(change) : `step ${change.position}: ${change.text}`)).join("; ")}`;
}

// --- Carried across a reload ---------------------------------------------------

const storageKey = (recipeId: string) => `garnish.cookChanges.${recipeId}`;

function isChange(value: unknown): value is CookChange {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.kind === "amount")
    return (
      typeof v.ingredientId === "string" &&
      typeof v.quantity === "number" &&
      typeof v.label === "string" &&
      typeof v.before === "string" &&
      typeof v.after === "string"
    );
  if (v.kind === "step") return typeof v.stepId === "string" && typeof v.position === "number" && typeof v.text === "string";
  return false;
}

/** `window.sessionStorage`, or undefined on the server or where reaching it throws. */
export function sessionStore(): StorageLike | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

/** The changes held for `recipeId` this session. Empty when none, malformed, or the storage throws. */
export function readChanges(storage: StorageLike | undefined, recipeId: string): CookChange[] {
  try {
    const raw = storage?.getItem(storageKey(recipeId));
    if (raw == null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isChange) : [];
  } catch {
    return [];
  }
}

/** Hold `changes` for `recipeId`; an empty list clears them. A throwing storage only means they do not survive a reload. */
export function writeChanges(storage: StorageLike | undefined, recipeId: string, changes: readonly CookChange[]): void {
  try {
    storage?.setItem(storageKey(recipeId), JSON.stringify(changes));
  } catch {
    // ignored: see above
  }
}
