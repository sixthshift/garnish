import { z } from "zod";
import { formatIngredient } from "../ingredient";
import type { Ingredient, Recipe } from "../recipe";
import type { Food, Unit } from "../reference";
import { adjustedIngredient, adjustedStep } from "./adjust";
import { type Adjustment, adjustmentSchema, type CookSession } from "./session";

// The review (decisions.md row 214): each of tonight's changes as a
// suggestion, before and after, kept in the recipe or left as tonight's. Pure.

/** What becomes of a suggestion: written into the recipe, only tonight's, or (a swap) added to its line as an alternative. */
export const DECISIONS = ["keep", "once", "alternative"] as const;
export type Decision = (typeof DECISIONS)[number];

/** One suggested change: the adjustment, why it is suggested, and the choice it starts on. */
export const suggestionSchema = z.object({ adjustment: adjustmentSchema, why: z.string().default(""), decision: z.enum(DECISIONS) });
export type Suggestion = z.infer<typeof suggestionSchema>;

/** A swap or a left-out line is usually for a missing ingredient, a one-off; a corrected amount, step or tip is what the recipe should have said. */
export function defaultDecision(adjustment: Pick<Adjustment, "kind">): Decision {
  return adjustment.kind === "swap" || adjustment.kind === "leave-out" ? "once" : "keep";
}

/** The choices a suggestion offers: a swap can also become an alternative on its line. */
export function decisionsFor(adjustment: Pick<Adjustment, "kind">): Decision[] {
  return adjustment.kind === "swap" ? ["keep", "once", "alternative"] : ["keep", "once"];
}

/** The suggestions a session makes without a model: each adjustment taken, at its default. */
export function sessionSuggestions(session: Pick<CookSession, "adjustments">): Suggestion[] {
  return session.adjustments.map((adjustment) => ({ adjustment, why: "Used tonight.", decision: defaultDecision(adjustment) }));
}

/** What a suggestion says it changes: the row's kind and place, and its before and after as the cook saw them. */
export type SuggestionView = { label: string; before: string | null; after: string };

function findIngredient(recipe: Recipe, id: string): { ingredient: Ingredient; partName: string } | null {
  for (const part of recipe.parts) {
    const ingredient = part.ingredients.find((row) => row.id === id);
    if (ingredient) return { ingredient, partName: part.name };
  }
  return null;
}

function findStep(recipe: Recipe, id: string): { position: number; partName: string; text: string; summary: string } | null {
  for (const part of recipe.parts) {
    const index = part.steps.findIndex((step) => step.id === id);
    if (index >= 0) return { position: index + 1, partName: part.name, text: part.steps[index]!.text, summary: part.steps[index]!.summary };
  }
  return null;
}

const where = (partName: string) => (partName.trim() === "" ? "" : ` · ${partName.trim()}`);

/**
 * A suggestion in words, at `servings` (the session's, or the recipe's own):
 * "Ingredient · swap", "1 cup celery, diced" → "1 cup carrot, diced". Null
 * when its row is no longer in the recipe.
 */
export function viewSuggestion(recipe: Recipe, adjustment: Adjustment, servings: number | null): SuggestionView | null {
  const scale = (ingredient: Ingredient) => {
    if (servings === null || !(recipe.recipeServings > 0) || ingredient.fixed || ingredient.quantity === null) return ingredient;
    const factor = servings / recipe.recipeServings;
    return { ...ingredient, quantity: ingredient.quantity * factor, quantityMax: ingredient.quantityMax === null ? null : ingredient.quantityMax * factor };
  };
  if ("ingredientId" in adjustment) {
    const found = findIngredient(recipe, adjustment.ingredientId);
    if (found === null) return null;
    const before = formatIngredient(scale(found.ingredient));
    const label = { amount: "Ingredient · amount", swap: "Ingredient · swap", "leave-out": "Ingredient · left out" }[adjustment.kind];
    if (adjustment.kind === "leave-out") return { label: label + where(found.partName), before, after: "Left out" };
    return { label: label + where(found.partName), before, after: formatIngredient(scale(adjustedIngredient(found.ingredient, adjustment))) };
  }
  const step = findStep(recipe, adjustment.stepId);
  if (step === null) return null;
  if (adjustment.kind === "tip") return { label: `Step ${step.position} · tip${where(step.partName)}`, before: null, after: adjustment.tip };
  return { label: `Step ${step.position} · method${where(step.partName)}`, before: step.text, after: adjustment.text };
}

/** The suggestions left as tonight's, as the words the cook log's comment opens with. Empty when there are none. */
export function onceNote(suggestions: readonly Pick<Suggestion, "adjustment" | "decision">[]): string {
  const once = suggestions.filter((suggestion) => suggestion.decision === "once").map((suggestion) => suggestion.adjustment.summary);
  return once.length === 0 ? "" : `Just this time: ${once.join("; ")}.`;
}

/** How the server turns a name into a stored row: a food is found or made; a unit only found. */
export type Resolve = { food: (name: string) => Food; unit: (name: string) => Unit | null };

/**
 * The stored recipe with the kept suggestions written in: what the review's
 * Save sends through `updateRecipe`, whose validation is the editor's. A
 * swap's food and unit come by name through `resolve`; a unit it cannot find
 * goes to the front of the line's note so the words are not lost. A kept
 * left-out line is removed, and with it every step's link to it.
 */
export function keptRecipe(recipe: Recipe, kept: readonly Pick<Suggestion, "adjustment" | "decision">[], resolve: Resolve): Recipe {
  const chosen = kept.filter((suggestion) => suggestion.decision === "keep" || suggestion.decision === "alternative");
  if (chosen.length === 0) return recipe;
  const removed = new Set(
    chosen.filter((s) => s.decision === "keep" && s.adjustment.kind === "leave-out").map((s) => (s.adjustment as { ingredientId: string }).ingredientId)
  );

  const ingredient = (row: Ingredient): Ingredient => {
    let next = row;
    for (const { adjustment, decision } of chosen) {
      if (!("ingredientId" in adjustment) || adjustment.ingredientId !== row.id) continue;
      if (adjustment.kind === "amount") next = { ...next, quantity: adjustment.quantity, quantityMax: null };
      if (adjustment.kind !== "swap") continue;
      const food = resolve.food(adjustment.food);
      const unit = adjustment.unit === null ? next.unit : adjustment.unit === "" ? null : resolve.unit(adjustment.unit);
      const lostUnit = adjustment.unit !== null && adjustment.unit !== "" && unit === null ? adjustment.unit : "";
      if (decision === "alternative") {
        next = {
          ...next,
          alternatives: [
            ...next.alternatives,
            { basisQuantity: null, basisUnit: null, note: lostUnit, planPicks: false, items: [{ quantity: adjustment.quantity, unit, food }] },
          ],
        };
      } else {
        const quantityMax = adjustment.quantity === null ? next.quantityMax : null;
        next = { ...next, food, quantity: adjustment.quantity ?? next.quantity, quantityMax, unit, note: [lostUnit, next.note].filter(Boolean).join(" ") };
      }
    }
    return next;
  };

  const adjustments = chosen.filter((s) => s.decision === "keep").map((s) => s.adjustment);
  return {
    ...recipe,
    parts: recipe.parts.map((part) => ({
      ...part,
      ingredients: part.ingredients.filter((row) => !removed.has(row.id)).map(ingredient),
      steps: part.steps.map((step) => {
        const next = adjustedStep(step, adjustments);
        return removed.size === 0 ? next : { ...next, ingredientIds: next.ingredientIds.filter((id) => !removed.has(id)) };
      }),
    })),
  };
}
