import { z } from "zod";

/**
 * The three meals a day can be planned for, Mealie's `entry_type` minus `side`
 * (decisions.md row 100): a side or a snack is an untyped entry. The enum
 * lives here rather than in `plan/` because the planner is what asks "which
 * meals do we plan?" and the plan is what labels an entry with the answer;
 * `plan/` imports it from this module.
 */
export const MEALS = ["breakfast", "lunch", "dinner"] as const;
export type Meal = (typeof MEALS)[number];

/** One of the three meals, as a write names it. */
export const mealName = z.enum(MEALS);

/** Whether the week is planned for a meal at all. One row per meal; the three are always read together. */
export const plannerMealSchema = z.object({ meal: mealName, enabled: z.boolean() });
export type PlannerMeal = z.infer<typeof plannerMealSchema>;

/** The meals the proposal fills, in the order a day eats them. Pure. */
export function enabledMeals(meals: readonly PlannerMeal[]): Meal[] {
  return MEALS.filter((meal) => meals.some((row) => row.meal === meal && row.enabled));
}
