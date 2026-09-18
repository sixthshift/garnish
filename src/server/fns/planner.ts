import { createServerFn } from "@tanstack/react-start";
import planner from "../../db/models/planner/repo";
import { PlannerMealsSet, PlannerRuleCreate, PlannerRuleId, PlannerRuleReorder, PlannerRuleUpdate } from "../../domain/planner";
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
