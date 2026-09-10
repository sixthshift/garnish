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
