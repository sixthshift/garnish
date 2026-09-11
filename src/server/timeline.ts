// Timeline server functions: the "Made this" log for one recipe. Each is the
// full `createServerFn` chain (see ./fn.ts for why), reads through getDb() and
// hands back `TimelineEvent` documents from src/domain/recipe.ts.
//
// The photo is not part of these calls: a create returns the event, the client
// then POSTs the file to /api/timeline/:id/image, which stores it and points
// the row at it (same split as recipe images).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { NotFound } from "./errors";
import { recipes } from "../db/models/recipe/repo";
import { timeline } from "../db/models/timeline/repo";
import { timelineEventInputSchema } from "../domain/recipe";
import { getDb } from "./db";
import { notFoundMiddleware } from "./fn";

const recipeId = z.uuid();

export const ListTimelineInput = z.object({ recipeId });

export const CreateTimelineEventInput = z.object({ recipeId, event: timelineEventInputSchema });

export const DeleteTimelineEventInput = z.object({ id: z.uuid() });

/** A recipe's logged cooks, newest first. */
export const listTimeline = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(ListTimelineInput)
  .handler(async ({ data }) => timeline(await getDb()).list(data.recipeId));

/**
 * Log a cook. Pulls `recipe.last_made` up to the recipe's latest date and
 * returns the stored event. 404 for an unknown recipe, so a stale page cannot
 * write an orphan row.
 */
export const createTimelineEvent = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(CreateTimelineEventInput)
  .handler(async ({ data }) => {
    const db = await getDb();
    if (!recipes(db).getById(data.recipeId)) throw new NotFound("recipe", data.recipeId);
    return timeline(db).create(data.recipeId, data.event);
  });

/** Delete a logged cook and recompute the recipe's last made date. */
export const deleteTimelineEvent = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(DeleteTimelineEventInput)
  .handler(async ({ data }) => {
    if (!timeline(await getDb()).remove(data.id)) throw new NotFound("timeline event", data.id);
    return { id: data.id };
  });
