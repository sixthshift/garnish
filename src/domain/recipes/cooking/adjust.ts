import type { Ingredient, Recipe, Step } from "../recipe";
import type { Food, Unit } from "../reference";
import type { Adjustment, AdjustmentInput } from "./session";

// Tonight's changes drawn on the page (decisions.md row 214): the recipe with
// each adjustment in it, without writing anything. Pure.

/**
 * The row an adjustment changes. One adjustment per row: a second change to
 * an ingredient replaces the first (a swap after an amount is the swap), and a
 * step holds its words and its tip separately.
 */
export function adjustmentKey(adjustment: Pick<Adjustment, "kind"> & ({ ingredientId: string } | { stepId: string })): string {
  if ("ingredientId" in adjustment) return `ingredient:${adjustment.ingredientId}`;
  return `${adjustment.kind === "tip" ? "tip" : "step"}:${adjustment.stepId}`;
}

/** `adjustments` with `adjustment` in it, replacing an earlier one to the same row. */
export function withAdjustment(adjustments: readonly Adjustment[], adjustment: Adjustment): Adjustment[] {
  const key = adjustmentKey(adjustment);
  return [...adjustments.filter((existing) => adjustmentKey(existing) !== key), adjustment];
}

/** Every ingredient and step in the recipe, by id. */
function rows(recipe: Recipe): { ingredients: Map<string, Ingredient>; steps: Map<string, Step> } {
  return {
    ingredients: new Map(recipe.parts.flatMap((part) => part.ingredients.map((ingredient) => [ingredient.id, ingredient] as const))),
    steps: new Map(recipe.parts.flatMap((part) => part.steps.map((step) => [step.id, step] as const))),
  };
}

/** Whether an adjustment names a row the recipe has. An offer naming anything else is dropped. */
export function fitsRecipe(recipe: Recipe, adjustment: AdjustmentInput): boolean {
  const { ingredients, steps } = rows(recipe);
  if ("ingredientId" in adjustment) {
    const ingredient = ingredients.get(adjustment.ingredientId);
    // An amount needs an amount to change.
    return ingredient !== undefined && (adjustment.kind !== "amount" || ingredient.quantity !== null);
  }
  return steps.has(adjustment.stepId);
}

/** A food drawn by name for tonight: the line's own food renamed, so its id still links the step's rows. */
function namedFood(name: string, like: Food | null, fallbackId: string): Food {
  return {
    id: like?.id ?? fallbackId,
    name,
    pluralName: null,
    aliases: [],
    aisle: null,
    recipeId: null,
    skipShopping: false,
    conversions: [],
  };
}

/** A unit drawn by name for tonight. */
function namedUnit(name: string, id: string): Unit {
  return {
    id,
    name,
    pluralName: null,
    abbreviation: "",
    useAbbreviation: false,
    fraction: true,
    portion: false,
    standardQuantity: null,
    standardUnitId: null,
  };
}

/** One ingredient as tonight has it. A left-out line is unchanged: the mark says so. */
export function adjustedIngredient(ingredient: Ingredient, adjustment: Adjustment): Ingredient {
  if (adjustment.kind === "amount") return { ...ingredient, quantity: adjustment.quantity };
  if (adjustment.kind !== "swap") return ingredient;
  return {
    ...ingredient,
    food: namedFood(adjustment.food, ingredient.food, adjustment.id),
    quantity: adjustment.quantity ?? ingredient.quantity,
    unit: adjustment.unit === null ? ingredient.unit : adjustment.unit === "" ? null : namedUnit(adjustment.unit, adjustment.id),
    // The note described the old food ("diced (Note 2)" may still hold, a brand will not); kept, as the cook can read past it.
  };
}

/** One step as tonight has it. A tip joins the step's supporting line. */
export function adjustedStep(step: Step, adjustments: readonly Adjustment[]): Step {
  let next = step;
  for (const adjustment of adjustments) {
    if (adjustment.kind === "step" && adjustment.stepId === step.id) next = { ...next, text: adjustment.text };
    if (adjustment.kind === "tip" && adjustment.stepId === step.id)
      next = { ...next, summary: [next.summary.trim(), adjustment.tip].filter(Boolean).join(" ") };
  }
  return next;
}

/** The stored recipe with tonight's adjustments in it, before scaling: what the cooking page draws. */
export function withAdjustments(recipe: Recipe, adjustments: readonly Adjustment[]): Recipe {
  if (adjustments.length === 0) return recipe;
  const byIngredient = new Map(adjustments.flatMap((adjustment) => ("ingredientId" in adjustment ? [[adjustment.ingredientId, adjustment] as const] : [])));
  return {
    ...recipe,
    parts: recipe.parts.map((part) => ({
      ...part,
      ingredients: part.ingredients.map((ingredient) => {
        const adjustment = byIngredient.get(ingredient.id);
        return adjustment === undefined ? ingredient : adjustedIngredient(ingredient, adjustment);
      }),
      steps: part.steps.map((step) => adjustedStep(step, adjustments)),
    })),
  };
}

/** What marks a row on the page: the adjustment, and whether the line is left out. Keyed by ingredient or step id. */
export type AdjustmentMark = { adjustment: Adjustment; leftOut: boolean };

/** Each changed row's mark. A step with both words and a tip is marked by its words. */
export function adjustmentMarks(adjustments: readonly Adjustment[]): Map<string, AdjustmentMark> {
  const marks = new Map<string, AdjustmentMark>();
  for (const adjustment of adjustments) {
    const rowId = "ingredientId" in adjustment ? adjustment.ingredientId : adjustment.stepId;
    if (adjustment.kind === "tip" && marks.has(rowId)) continue;
    marks.set(rowId, { adjustment, leftOut: adjustment.kind === "leave-out" });
  }
  return marks;
}
