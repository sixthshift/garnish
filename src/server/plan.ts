// Meal plan server functions: the one household plan (decisions.md row 71).
// Each is the full `createServerFn` chain (see ./fn.ts for why), reads through
// getDb() and hands back the documents in src/domain/plan.ts.
//
// There is no plan id in any signature because there is no second plan, and no
// meal type because the day is the slot. A week is read whole: `listPlanWeek`
// takes the Monday and answers with seven days.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { plan } from "../db/models/plan/repo";
import { isoDate, planEntryInputSchema, planEntryPatchSchema } from "../domain/plan";
import { Id, IdInput } from "../domain/reference";
import { getDb } from "./db";
import { required } from "./errors";
import { notFoundMiddleware } from "./fn";

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
