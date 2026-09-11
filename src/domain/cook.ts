// Cook mode's card sequence. Pure: the recipe document in, a flat list of
// cards out, so the route only has to pick one by index. Component order first
// (each component's ingredients as one card, then a card per step), then the
// recipe-level steps. A component with no ingredients gets no ingredient card
// and one with nothing at all contributes nothing: a blank card is a wasted tap.
import type { Ingredient, Recipe, Step } from "./recipe";

export type CookCard =
  | {
      kind: "ingredients";
      /** Component name, trimmed; "" for the unnamed section of a flat recipe. */
      component: string;
      ingredients: Ingredient[];
    }
  | {
      kind: "step";
      component: string;
      step: Step;
      /** 1-based position within its component (or the recipe-level list). */
      number: number;
      /** Steps in that same list. */
      total: number;
    };

/** Label the view page gives recipe-level steps: "To finish" only when there is more than one component. */
export function finishLabel(recipe: Pick<Recipe, "components">): string {
  return recipe.components.length > 1 ? "To finish" : "";
}

/** Component cards in order, then recipe-level steps. Pure. */
export function buildCookCards(recipe: Pick<Recipe, "components" | "steps">): CookCard[] {
  const cards: CookCard[] = [];
  const stepCards = (component: string, steps: Step[]) =>
    steps.forEach((step, index) => cards.push({ kind: "step", component, step, number: index + 1, total: steps.length }));

  for (const component of recipe.components) {
    const name = component.name.trim();
    if (component.ingredients.length > 0) cards.push({ kind: "ingredients", component: name, ingredients: component.ingredients });
    stepCards(name, component.steps);
  }
  stepCards(finishLabel(recipe), recipe.steps);
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
 * Dough" ("Ingredients" where the component has no name). Pure.
 */
export function cardAnnouncement(card: CookCard): string {
  if (card.kind === "step") return `Step ${card.number} of ${card.total}`;
  return card.component === "" ? "Ingredients" : `Ingredients for ${card.component}`;
}

/** One component pill: the deck index its first card sits at. */
export type CookPill = {
  /** The component name as the cards carry it; "" for the unnamed section. */
  name: string;
  /** What the pill reads; the unnamed section is "Recipe". */
  label: string;
  index: number;
};

/**
 * A pill per component in deck order, each pointing at that component's first
 * card. Components are contiguous in the deck, but the first index is taken by
 * name so a repeated name still lands on its opening card. Pure.
 */
export function componentPills(cards: CookCard[]): CookPill[] {
  const pills: CookPill[] = [];
  cards.forEach((card, index) => {
    if (pills.some((pill) => pill.name === card.component)) return;
    pills.push({ name: card.component, label: card.component === "" ? "Recipe" : card.component, index });
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
