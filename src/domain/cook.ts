// Cook mode's card sequence. Pure: the recipe document in, a flat list of
// cards out, so the route only has to pick one by index. Part order: each
// part's ingredients as one card, then a card per step. A part with no
// ingredients gets no ingredient card and one with nothing at all contributes
// nothing: a blank card is a wasted tap.
import type { Ingredient, Recipe, Step } from "./recipe";

export type CookCard =
  | {
      kind: "ingredients";
      /** Part name, trimmed; "" for the unnamed part. */
      part: string;
      ingredients: Ingredient[];
    }
  | {
      kind: "step";
      part: string;
      step: Step;
      /** 1-based position within its part. */
      number: number;
      /** Steps in that same part. */
      total: number;
      /**
       * That part's ingredients, carried so the card can show the ones this
       * step names (M26.1, src/domain/stepIngredients.ts). The card is the
       * whole screen in cook mode, so the list is not on it anywhere else.
       */
      ingredients: Ingredient[];
    };

/** Every part's cards in order: its ingredients, then a card per step. Pure. */
export function buildCookCards(recipe: Pick<Recipe, "parts">): CookCard[] {
  const cards: CookCard[] = [];

  for (const part of recipe.parts) {
    const name = part.name.trim();
    if (part.ingredients.length > 0) cards.push({ kind: "ingredients", part: name, ingredients: part.ingredients });
    part.steps.forEach((step, index) =>
      cards.push({
        kind: "step",
        part: name,
        step,
        number: index + 1,
        total: part.steps.length,
        ingredients: part.ingredients,
      }),
    );
  }
  return cards;
}

/** `step` held within the card range; an empty deck yields 0. Pure. */
export function clampStep(step: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(0, Math.trunc(step)), count - 1);
}

/**
 * How many positions the deck spans once the synthetic Finished screen at the
 * end is counted: one more than the card count, or 0 for an empty deck (there
 * is nothing to finish). Feed this to `clampStep` instead of `cards.length` so
 * a route can land on Finished, including by overshooting past the last card.
 * Pure.
 */
export function totalWithFinish(cardCount: number): number {
  return cardCount > 0 ? cardCount + 1 : 0;
}

/** Whether `index` sits on the synthetic Finished screen just past the last card of a non-empty deck. Pure. */
export function isFinishedIndex(index: number, cardCount: number): boolean {
  return cardCount > 0 && index === cardCount;
}

/**
 * A card's spoken label for the live region: "Step 2 of 5", or "Ingredients for
 * Dough" ("Ingredients" where the part has no name). Pure.
 */
export function cardAnnouncement(card: CookCard): string {
  if (card.kind === "step") return `Step ${card.number} of ${card.total}`;
  return card.part === "" ? "Ingredients" : `Ingredients for ${card.part}`;
}

/** One part pill: the deck index its first card sits at. */
export type CookPill = {
  /** The part name as the cards carry it; "" for the unnamed part. */
  name: string;
  /** What the pill reads; the unnamed part is "Recipe". */
  label: string;
  index: number;
};

/**
 * A pill per part in deck order, each pointing at that part's first card.
 * Parts are contiguous in the deck, but the first index is taken by name so a
 * repeated name still lands on its opening card. Pure.
 */
export function partPills(cards: CookCard[]): CookPill[] {
  const pills: CookPill[] = [];
  cards.forEach((card, index) => {
    if (pills.some((pill) => pill.name === card.part)) return;
    pills.push({ name: card.part, label: card.part === "" ? "Recipe" : card.part, index });
  });
  return pills;
}

/** Pixels a pointer must travel vertically before a drag counts as a swipe rather than a scroll. */
export const SWIPE_MIN_PX = 56;

/** How much longer the vertical travel must be than the horizontal for the gesture to be vertical at all. */
export const SWIPE_RATIO = 1.4;

/** A gesture slower than this is a scroll or a rest, not a flick. */
export const SWIPE_MAX_MS = 800;

/** One finished pointer gesture: total travel and how long it took. */
export type Swipe = { dx: number; dy: number; ms: number };

/**
 * Which way a finished gesture moves the deck: swiping up brings the next card
 * on, swiping down the previous one, as a page of cards would. Null for
 * anything that reads as a scroll, a tap, or a sideways drag — the thresholds
 * above are the scroll-versus-swipe line. Pure, so the route only wires
 * pointers to it.
 */
export function swipeIntent({ dx, dy, ms }: Swipe): "next" | "prev" | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(ms)) return null;
  if (ms > SWIPE_MAX_MS || ms < 0) return null;
  if (Math.abs(dy) < SWIPE_MIN_PX) return null;
  if (Math.abs(dy) < Math.abs(dx) * SWIPE_RATIO) return null;
  return dy < 0 ? "next" : "prev";
}
