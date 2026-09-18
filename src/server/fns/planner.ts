import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import plan from "../../db/models/plan/repo";
import planner from "../../db/models/planner/repo";
import recipes from "../../db/models/recipe/repo";
import { isoDate, planEntryInputSchema, weekDates, weekMonday } from "../../domain/plan";
import { mealName, PlannerMealsSet, PlannerRuleCreate, PlannerRuleId, PlannerRuleReorder, PlannerRuleUpdate } from "../../domain/planner";
import { Id } from "../../domain/reference";
import { aiConfigured } from "../ai/client";
import { proposeWeek } from "../ai/planner";
import { required } from "../core/errors";
import { notFoundMiddleware } from "../core/fn";

/** The whole planner guide in reading order. No query: a handful of statements are always read together. */
export const listPlannerRules = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .handler(async () => planner.rules.list());

/** A new statement, at the foot of the guide and on unless told otherwise. */
export const createPlannerRule = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(PlannerRuleCreate)
  .handler(async ({ data }) => planner.rules.create(data));

/** Edit in place: the text, the switch, or both. */
export const updatePlannerRule = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(PlannerRuleUpdate)
  .handler(async ({ data: { id, ...patch } }) => required(planner.rules.update(id, patch), "planner rule", id));

/** Deletes and returns the row, as the other deletes do. */
export const deletePlannerRule = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(PlannerRuleId)
  .handler(async ({ data }) => {
    const rule = required(planner.rules.get(data.id), "planner rule", data.id);
    planner.rules.remove(data.id);
    return rule;
  });

/** Set every statement's position from its index in `ids` (the full order); returns the guide in the new order. */
export const reorderPlannerRules = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(PlannerRuleReorder)
  .handler(async ({ data }) => planner.rules.reorder(data.ids));

/** The three meals and whether a proposed week plans for each. */
export const listPlannerMeals = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .handler(async () => planner.meals.list());

/** Turn meals on or off; answers all three, so the settings tab redraws from one result. */
export const setPlannerMeals = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(PlannerMealsSet)
  .handler(async ({ data }) => planner.meals.set(data.meals));

// --- The proposal (M39.4) --------------------------------------------------

/**
 * The week to propose for: the Monday, and the days of that week that were
 * ticked. At least one day, every one a day of that week — a proposal for a
 * day the caller is not showing is a proposal nobody asked for.
 */
export const ProposePlanWeekInput = z
  .object({ monday: isoDate, dates: z.array(isoDate).min(1, "tick at least one day") })
  .refine(({ monday, dates }) => dates.every((date) => weekDates(monday).includes(date)), {
    message: "every date must be a day of that week",
    path: ["dates"],
  });

/**
 * Propose a filling for the week's open slots. Reads the library, the week,
 * the last four weeks and the planner guide, asks the model once, and answers
 * with the checked week — the entries to review (each carrying the recipe to
 * draw), the lines dropped, the slots left empty and the ones the week already
 * had. Nothing is written: `applyPlanProposal` is what writes.
 */
export const proposePlanWeek = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(ProposePlanWeekInput)
  .handler(async ({ data }) => {
    const dates = weekDates(data.monday).filter((date) => data.dates.includes(date));
    return proposeWeek({ monday: data.monday, dates });
  });

/** The entries the household ticked, as the sheet sends them: a slot and the recipe that fills it. */
export const ApplyPlanProposalInput = z.object({
  entries: z
    .array(
      z.object({
        date: isoDate,
        meal: mealName,
        recipeId: Id,
      })
    )
    .default([]),
});

/**
 * Write an accepted proposal. Each entry goes through the plan's own `add`
 * with the recipe's name copied into `text`, exactly as the plan page's add
 * row does, and all of them in one transaction: a recipe that has since been
 * deleted is a not-found for the whole write rather than half a week on the
 * calendar. Answers with the week, so the page redraws from one result.
 */
export const applyPlanProposal = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(ApplyPlanProposalInput)
  .handler(async ({ data }) => {
    // Every recipe is read first: a missing one fails before anything is written.
    const inputs = data.entries.map((entry) => {
      const recipe = required(recipes.getById(entry.recipeId), "recipe", entry.recipeId);
      return planEntryInputSchema.parse({ date: entry.date, recipeId: recipe.id, text: recipe.name, meal: entry.meal });
    });
    plan.addMany(inputs);
    return plan.week(weekMonday(data.entries[0]?.date));
  });

/**
 * Whether a model is configured at all, for the Propose button. The same
 * answer `aiImportAvailable` gives — one key is the whole of the setup — under
 * its own name so the plan page does not read the import's gate.
 */
export const plannerAvailable = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .handler(() => ({ available: aiConfigured() }));
