// The plan's choice among a line's alternatives (decisions.md rows 198 and
// 199): the line's own food is the default, the alternatives it marks
// `planPicks` are the others, and a plan entry says which one each line
// takes, as ingredient id to food id.

import { alternativeAt } from "./alternatives";
import type { Alternative, AlternativeItem, Ingredient, Recipe } from "./recipe";

/** Which food each line takes: ingredient id to food id. A line not named takes its own. */
export type Choices = Readonly<Record<string, string>>;

/** A line's alternatives the plan picks among, in order. */
function planned(row: Ingredient): Alternative[] {
  return row.alternatives.filter((alt) => alt.planPicks);
}

/** The lines a plan chooses for, in recipe order: a food of their own and an alternative the plan picks. */
export function choiceRows(recipe: Recipe): Ingredient[] {
  return recipe.parts.flatMap((part) => part.ingredients.filter((row) => row.food !== null && planned(row).length > 0));
}

/** What a choice picks from, at the line's amount: the line's own food first, then each alternative the plan picks. Pure. */
export function rowChoices(row: Ingredient): AlternativeItem[] {
  const own = row.food === null ? [] : [{ quantity: row.quantity, unit: row.unit, food: row.food }];
  return [...own, ...planned(row).map((alt) => alternativeAt(row, alt).items[0]!)];
}

/**
 * The line as it is made with `foodId`: that alternative's food at its
 * amount. The line's own food becomes one of its alternatives the plan picks,
 * so the page can still say what else it could have been; the others stay. A
 * food that is not one the plan picks for the line, or is its own, leaves it
 * as it is. Pure.
 */
export function chooseOption(row: Ingredient, foodId: string): Ingredient {
  if (row.food === null || row.food.id === foodId) return row;
  const chosen = planned(row).find((alt) => alt.items[0]!.food.id === foodId);
  if (chosen === undefined) return row;
  const made = alternativeAt(row, chosen).items[0]!;
  const own: Alternative = {
    basisQuantity: null,
    basisUnit: null,
    note: "",
    planPicks: true,
    items: [{ quantity: row.quantity, unit: row.unit, food: row.food }],
  };
  return {
    ...row,
    food: made.food,
    quantity: made.quantity,
    // An option at the line's own amount keeps its range; one with its own amount has none.
    quantityMax: made.quantity === row.quantity && made.unit === row.unit ? row.quantityMax : null,
    unit: made.unit,
    originalText: "",
    alternatives: [own, ...row.alternatives.filter((alt) => alt !== chosen)],
  };
}

/** The recipe with every chosen line made with its choice. A choice naming no line, or nothing the plan picks for it, is ignored. Pure. */
export function withChoices(recipe: Recipe, choices: Choices): Recipe {
  if (Object.keys(choices).length === 0) return recipe;
  return {
    ...recipe,
    parts: recipe.parts.map((part) => ({
      ...part,
      ingredients: part.ingredients.map((row) => {
        const foodId = choices[row.id];
        return foodId === undefined ? row : chooseOption(row, foodId);
      }),
    })),
  };
}

/**
 * A choice for every line the plan chooses for, picked so the recipe varies
 * from one time it is planned to the next: the food the `history` (earlier
 * entries' choices, oldest first) has used least, a line not named counting as
 * its own food; on a tie, the one used longest ago, then the earliest listed.
 * Pure.
 */
export function rotateChoices(recipe: Recipe, history: readonly Choices[]): Record<string, string> {
  const choices: Record<string, string> = {};
  for (const row of choiceRows(recipe)) {
    const candidates = rowChoices(row).map((item) => item.food.id);
    const used = history.map((past) => (past[row.id] !== undefined && candidates.includes(past[row.id]!) ? past[row.id]! : candidates[0]!));
    const count = (id: string) => used.filter((past) => past === id).length;
    const last = (id: string) => used.lastIndexOf(id);
    choices[row.id] = [...candidates].sort((a, b) => count(a) - count(b) || last(a) - last(b) || candidates.indexOf(a) - candidates.indexOf(b))[0]!;
  }
  return choices;
}

/** The foods a choice names, in recipe order, by name: "beef strips". Lines on their own food are left out. Pure. */
export function choiceNames(recipe: Recipe, choices: Choices): string[] {
  return choiceRows(recipe).flatMap((row) => {
    const alt = planned(row).find((candidate) => candidate.items[0]!.food.id === choices[row.id]);
    return alt === undefined ? [] : [alt.items[0]!.food.name];
  });
}
