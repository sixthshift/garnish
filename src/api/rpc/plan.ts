import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import plan from "../../db/models/plan/repo";
import recipes from "../../db/models/recipe/repo";
import shopping from "../../db/models/shopping/repo";
import { isoDate, planEntryInputSchema, planEntryPatchSchema, planWeekAdditions } from "../../domain/plan/plan";
import { type Recipe, scaledForServings, withChoices } from "../../domain/recipes/recipe";
import { Id, IdInput } from "../../domain/recipes/reference";
import { required } from "../../server/core/errors";
import { notFoundMiddleware } from "../../server/core/fn";
import { withRotatedChoices } from "../../server/plan/choices";

/** `?week=` is the Monday's date; a date mid-week is normalised to its Monday. */
export const PlanWeekInput = z.object({ monday: isoDate });

export const AddPlanEntryInput = planEntryInputSchema;

export const UpdatePlanEntryInput = planEntryPatchSchema.extend({ id: Id });

export const MovePlanEntryInput = z.object({
  id: Id,
  date: isoDate,
  position: z.number().int().nonnegative(),
});

/** The seven days beginning `monday`, empty days included. */
export const listPlanWeek = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(PlanWeekInput)
  .handler(async ({ data }) => plan.week(data.monday));

/** Append an entry to the end of its day: a recipe, or a plain line. */
export const addPlanEntry = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(AddPlanEntryInput)
  .handler(async ({ data }) => plan.add(withRotatedChoices([data])[0]!));

/** Merge a patch into one entry — the servings stepper, or retyping a line. */
export const updatePlanEntry = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(UpdatePlanEntryInput)
  .handler(async ({ data: { id, ...patch } }) => required(plan.update(id, patch), "plan entry", id));

/** Drag an entry to a day and a position; both days renumber. */
export const movePlanEntry = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(MovePlanEntryInput)
  .handler(async ({ data }) => required(plan.move(data.id, data.date, data.position), "plan entry", data.id));

export const ReplacePlanEntryInput = z.object({ id: Id, entry: planEntryInputSchema });

/** Put a new entry in an old one's place, in one write: Home's Swap. */
export const replacePlanEntry = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(ReplacePlanEntryInput)
  .handler(async ({ data }) => required(plan.replace(data.id, withRotatedChoices([data.entry])[0]!), "plan entry", data.id));

/** Delete one entry. Returns the id, as the timeline and shopping deletes do. */
export const removePlanEntry = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(IdInput)
  .handler(async ({ data }) => {
    required(plan.get(data.id), "plan entry", data.id);
    plan.remove(data.id);
    return { id: data.id };
  });

export const AddPlanWeekToShoppingInput = z.object({ monday: isoDate });

/**
 * "Add this week to the shopping list": every recipe entry's own
 * ingredients at the entry's servings (the recipe's own when unset), plus
 * every text entry as a free-text line, stamped with the entry's day rather
 * than the recipe's own part (`planWeekAdditions`, src/domain/plan/plan/week.ts), merged
 * into the current list the same way the recipe page's own "Add to shopping
 * list" does (`mergeIntoList`). The week's recipes are loaded and
 * scaled through the same path `getRecipe` takes, so the client need not
 * re-read the plan or the recipes to build the additions itself. Returns how
 * many lines the list gained, for the toast.
 */
export const addPlanWeekToShopping = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(AddPlanWeekToShoppingInput)
  .handler(async ({ data }) => {
    const days = plan.week(data.monday);
    const scaled = new Map<string, Recipe>();
    for (const day of days) {
      for (const entry of day.entries) {
        if (entry.recipe === null) continue;
        const doc = recipes.get(entry.recipe.slug);
        if (doc === null) continue;
        // Made with what the plan chose for it (decisions.md row 198), then scaled.
        const chosen = withChoices(doc, entry.choices);
        scaled.set(entry.id, scaledForServings(chosen, entry.servings ?? undefined));
      }
    }

    return { added: shopping.addMerged(planWeekAdditions(days, scaled)) };
  });
