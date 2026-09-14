// Cook mode's card sequence. Pure: the recipe document in, a flat list of
// cards out, so the route only has to pick one by index. Part order: each
// part's ingredients card, then a card per step. The ingredients card carries
// only the rows none of the part's steps link — a linked row is read on its
// step card instead (M29.2, StepCard resolves the link) — so a part where
// every row is linked gets no ingredients card, and one with nothing at all
// contributes nothing: a blank card is a wasted tap.
import { type Ingredient, type Recipe, type Step } from "./recipe";

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
       * step names (M26.1, src/domain/recipe/stepIngredients.ts). The card is the
       * whole screen in cook mode, so the list is not on it anywhere else.
       */
      ingredients: Ingredient[];
    };

/**
 * Every part's cards in order: an ingredients card for its rows that no step
 * of the part links, then a card per step (each still carrying the part's
 * full ingredients, so `StepCard` can resolve its own links). Pure.
 */
export function buildCookCards(recipe: Pick<Recipe, "parts">): CookCard[] {
  const cards: CookCard[] = [];

  for (const part of recipe.parts) {
    const name = part.name.trim();
    const linkedIds = new Set(part.steps.flatMap((step) => step.ingredientIds));
    const unlinked = part.ingredients.filter((ingredient) => !linkedIds.has(ingredient.id));
    if (unlinked.length > 0) cards.push({ kind: "ingredients", part: name, ingredients: unlinked });
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

/** How long a step's preview line can run before it is cut with an ellipsis. */
export const PREVIEW_MAX_CHARS = 80;

/** The first non-empty line of `text`, its list/emphasis markers dropped rather than fully parsed. Pure. */
function previewLine(text: string): string {
  const line = text
    .split("\n")
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate !== "");
  if (line === undefined) return "";
  return line
    .replace(/^\s{0,3}(?:[-*+]|\d{1,9}[.)])\s+/, "")
    .replace(/\*\*|__|\*|_/g, "")
    .trim();
}

/** `text`, cut with an ellipsis once it runs past `PREVIEW_MAX_CHARS`. Pure. */
function truncatePreview(text: string): string {
  if (text.length <= PREVIEW_MAX_CHARS) return text;
  return `${text.slice(0, PREVIEW_MAX_CHARS - 1).trimEnd()}…`;
}

/**
 * The one-line preview of the card after `cards[index]`, for a "Next: …"
 * footer: a following step's first line (truncated), a following ingredients
 * card's own heading ("Ingredients" / "Ingredients for <part>"), or
 * "Finished" once `index` is the deck's last card — which also covers an
 * empty deck, since there is no card at `index + 1` either way. Pure.
 */
export function nextPreview(cards: CookCard[], index: number): string {
  const next = cards[index + 1];
  if (next === undefined) return "Finished";
  if (next.kind === "ingredients") return next.part === "" ? "Ingredients" : `Ingredients for ${next.part}`;
  return truncatePreview(previewLine(next.step.text));
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

/** The card index an arrow key moves to, or null when the key is not one of ours. Pure. */
export function stepForKey(key: string, index: number, count: number): number | null {
  if (key === "ArrowLeft") return index > 0 ? index - 1 : null;
  if (key === "ArrowRight") return index < count - 1 ? index + 1 : null;
  return null;
}

/** "3 of 12", with the part name when the card has one. Pure. */
export function positionLabel(index: number, count: number, part: string): string {
  const position = `${index + 1} of ${count}`;
  return part === "" ? position : `${position} · ${part}`;
}
