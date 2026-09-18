import { sql } from "drizzle-orm";
import { check, index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { MEALS } from "../../../domain/plan";
import { recipe } from "../recipe/schema";

/**
 * One entry on one day. A recipe entry has `recipeId`, with `servings`
 * optionally overriding the recipe's own; a plain line has `text`
 * ("leftovers"). `position` orders the entries within their day and is
 * deliberately not unique — a move rewrites a day's rows in one transaction.
 *
 * `meal` names the entry's slot (breakfast / lunch / dinner) and is NULL for
 * the entries that name none, which is most of them: the day is still the
 * unit the week draws (decisions.md rows 71 and 100). It does not order
 * anything — `position` is still the only order within a day.
 *
 * `recipeId` goes null when the recipe is deleted rather than taking the day's
 * entry with it; the row is still a fact about that day.
 */
export const mealPlanEntry = sqliteTable(
  "meal_plan_entry",
  {
    id: text("id").primaryKey(),
    /** A calendar date, `YYYY-MM-DD`, as `timeline_event.occurred_on` is. */
    date: text("date").notNull(),
    position: integer("position").notNull(),
    recipeId: text("recipe_id").references(() => recipe.id, { onDelete: "set null" }),
    /** The whole entry when there is no recipe; '' on a recipe entry. */
    text: text("text").notNull().default(""),
    /** NULL: cook the recipe at its own servings. */
    servings: real("servings"),
    /** NULL: an entry with no slot. Mealie's `entry_type` minus `side`. */
    meal: text("meal", { enum: MEALS }),
  },
  (t) => [
    index("meal_plan_entry_date").on(t.date, t.position),
    index("meal_plan_entry_recipe_id").on(t.recipeId),
    index("meal_plan_entry_date_meal").on(t.date, t.meal),
    check("date_is_a_date", sql`${t.date} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`),
    check("meal_is_a_meal", sql`${t.meal} IN ('breakfast', 'lunch', 'dinner')`),
  ]
);
