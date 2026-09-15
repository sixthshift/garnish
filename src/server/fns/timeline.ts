import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import recipes from "../../db/models/recipe/repo";
import timeline from "../../db/models/timeline/repo";
import { timelineEventInputSchema } from "../../domain/recipe";
import { NotFound } from "../core/errors";
import { notFoundMiddleware } from "../core/fn";

const recipeId = z.uuid();

export const ListTimelineInput = z.object({ recipeId });

export const CreateTimelineEventInput = z.object({ recipeId, event: timelineEventInputSchema });

export const DeleteTimelineEventInput = z.object({ id: z.uuid() });

/** A recipe's logged cooks, newest first. */
export const listTimeline = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(ListTimelineInput)
  .handler(async ({ data }) => timeline.list(data.recipeId));

/**
 * Log a cook. Pulls `recipe.last_made` up to the recipe's latest date and
 * returns the stored event. 404 for an unknown recipe, so a stale page cannot
 * write an orphan row.
 */
export const createTimelineEvent = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(CreateTimelineEventInput)
  .handler(async ({ data }) => {
    if (!recipes.getById(data.recipeId)) throw new NotFound("recipe", data.recipeId);
    return timeline.create(data.recipeId, data.event);
  });

/** Delete a logged cook and recompute the recipe's last made date. */
export const deleteTimelineEvent = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(DeleteTimelineEventInput)
  .handler(async ({ data }) => {
    if (!timeline.remove(data.id)) throw new NotFound("timeline event", data.id);
    return { id: data.id };
  });
