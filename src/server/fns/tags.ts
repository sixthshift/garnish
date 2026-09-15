import { createServerFn } from "@tanstack/react-start";
import recipes from "../../db/models/recipe/repo";
import tags from "../../db/models/tag/repo";
import { IdInput, ListQuery, NameInput, TagCreate, TagMerge, TagUpdate } from "../../domain/reference";
import { required } from "../core/errors";
import { notFoundMiddleware } from "../core/fn";

export const listTags = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(ListQuery)
  .handler(async ({ data }) => tags.list(data.q));

export const createTag = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(TagCreate)
  .handler(async ({ data }) => tags.create(data));

export const updateTag = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(TagUpdate)
  .handler(async ({ data: { id, ...patch } }) => required(tags.update(id, patch), "tag", id));

/** Deletes and returns the row, as Mealie does. */
export const deleteTag = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(IdInput)
  .handler(async ({ data }) => {
    const tag = required(tags.get(data.id), "tag", data.id);
    tags.remove(data.id);
    return tag;
  });

/** The existing tag with this name (case-insensitive), else a new one. */
export const findOrCreateTag = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(NameInput)
  .handler(async ({ data }) => tags.findOrCreate(data.name));

/** The recipes carrying this tag, for the delete/merge confirm dialogs. */
export const usingTag = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(IdInput)
  .handler(async ({ data }) => recipes.usingTag(data.id));

/**
 * Merge `sourceId` into `targetId`: every recipe carrying the source tag
 * gains the target tag, then the source is deleted, in one transaction.
 * Not-found when either id is unknown.
 */
export const mergeTag = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(TagMerge)
  .handler(async ({ data: { sourceId, targetId } }) => {
    required(tags.get(sourceId), "tag", sourceId);
    required(tags.get(targetId), "tag", targetId);
    return required(tags.merge(sourceId, targetId), "tag", targetId);
  });
