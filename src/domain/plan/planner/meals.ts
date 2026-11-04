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
