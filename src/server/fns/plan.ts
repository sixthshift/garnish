// Meal plan server functions: the one household plan (decisions.md row 71).
// Each is the full `createServerFn` chain (see ./fn.ts for why), reads through
// getDb() and hands back the documents in src/domain/plan/plan.ts.
//
// There is no plan id in any signature because there is no second plan, and no
// meal type because the day is the slot. A week is read whole: `listPlanWeek`
// takes the Monday and answers with seven days.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { plan } from "../../db/models/plan/repo";
import { recipes } from "../../db/models/recipe/repo";
import { shopping } from "../../db/models/shopping/repo";
import { isoDate, planEntryInputSchema, planEntryPatchSchema, planWeekAdditions } from "../../domain/plan/plan";
import { Id, IdInput } from "../../domain/reference/reference";
import type { Recipe } from "../../domain/recipe/recipe";
import { scaleRecipe } from "../../domain/recipe/scale";
import { mergeIntoList, shoppingItemInputSchema } from "../../domain/shopping/shopping";
import { getDb } from "../core/db";
import { required } from "../core/errors";
import { notFoundMiddleware } from "../core/fn";

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
  .handler(async ({ data }) => plan(await getDb()).week(data.monday));

/** Append an entry to the end of its day: a recipe, or a plain line. */
export const addPlanEntry = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(AddPlanEntryInput)
  .handler(async ({ data }) => plan(await getDb()).add(data));

/** Merge a patch into one entry — the servings stepper, or retyping a line. */
export const updatePlanEntry = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(UpdatePlanEntryInput)
  .handler(async ({ data: { id, ...patch } }) => required(plan(await getDb()).update(id, patch), "plan entry", id));

/** Drag an entry to a day and a position; both days renumber. */
export const movePlanEntry = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(MovePlanEntryInput)
  .handler(async ({ data }) => required(plan(await getDb()).move(data.id, data.date, data.position), "plan entry", data.id));

/** Delete one entry. Returns the id, as the timeline and shopping deletes do. */
export const removePlanEntry = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(IdInput)
  .handler(async ({ data }) => {
    const repo = plan(await getDb());
    required(repo.get(data.id), "plan entry", data.id);
    repo.remove(data.id);
    return { id: data.id };
  });

export const AddPlanWeekToShoppingInput = z.object({ monday: isoDate });

/**
 * "Add this week to the shopping list" (M33.3): every recipe entry's own
 * ingredients at the entry's servings (the recipe's own when unset), plus
 * every text entry as a free-text line, stamped with the entry's day rather
 * than the recipe's own part (`planWeekAdditions`, src/domain/plan/plan.ts), merged
 * into the current list the same way the recipe page's own "Add to shopping
 * list" does (`mergeIntoList`, M31.2). The week's recipes are loaded and
 * scaled through the same path `getRecipe` takes, so the client need not
 * re-read the plan or the recipes to build the additions itself. Returns how
 * many lines the list gained, for the toast.
 */
export const addPlanWeekToShopping = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(AddPlanWeekToShoppingInput)
  .handler(async ({ data }) => {
    const db = await getDb();
    const days = plan(db).week(data.monday);
    const recipeRepo = recipes(db);
    const scaled = new Map<string, Recipe>();
    for (const day of days) {
      for (const entry of day.entries) {
        if (entry.recipe === null) continue;
        const doc = recipeRepo.get(entry.recipe.slug);
        if (doc === null) continue;
        scaled.set(entry.id, entry.servings === null || doc.recipeServings <= 0 ? doc : scaleRecipe(doc, entry.servings));
      }
    }

    const shoppingRepo = shopping(db);
    const mergePlan = mergeIntoList(shoppingRepo.list(), planWeekAdditions(days, scaled));
    // `mergeIntoList` hands back the write shape pre-defaults (as a caller's
    // own POST body would arrive); parsed here since this handler writes
    // straight through the repository rather than through `addShoppingItems`.
    if (mergePlan.additions.length > 0) shoppingRepo.addMany(mergePlan.additions.map((item) => shoppingItemInputSchema.parse(item)));
    for (const merge of mergePlan.merges) shoppingRepo.mergeInto(merge.id, merge.quantity, merge.sources);
    return { added: mergePlan.merges.length + mergePlan.additions.length };
  });
