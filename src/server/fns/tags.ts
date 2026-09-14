// Tag server functions. Every id lookup that misses raises NotFound.
import { createServerFn } from "@tanstack/react-start";
import { required } from "../core/errors";
import { recipes } from "../../db/models/recipe/repo";
import { tags } from "../../db/models/tag/repo";
import { IdInput, ListQuery, NameInput, TagCreate, TagMerge, TagUpdate } from "../../domain/reference/reference";
import { getDb } from "../core/db";
import { notFoundMiddleware } from "../core/fn";

export const listTags = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(ListQuery)
  .handler(async ({ data }) => tags(await getDb()).list(data.q));

export const createTag = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(TagCreate)
  .handler(async ({ data }) => tags(await getDb()).create(data));

export const updateTag = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(TagUpdate)
  .handler(async ({ data: { id, ...patch } }) => required(tags(await getDb()).update(id, patch), "tag", id));

/** Deletes and returns the row, as Mealie does. */
export const deleteTag = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(IdInput)
  .handler(async ({ data }) => {
    const repo = tags(await getDb());
    const tag = required(repo.get(data.id), "tag", data.id);
    repo.remove(data.id);
    return tag;
  });

/** The existing tag with this name (case-insensitive), else a new one. */
export const findOrCreateTag = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(NameInput)
  .handler(async ({ data }) => tags(await getDb()).findOrCreate(data.name));

/** The recipes carrying this tag, for the delete/merge confirm dialogs. */
export const usingTag = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(IdInput)
  .handler(async ({ data }) => recipes(await getDb()).usingTag(data.id));

/**
 * Merge `sourceId` into `targetId`: every recipe carrying the source tag
 * gains the target tag, then the source is deleted, in one transaction.
 * Not-found when either id is unknown.
 */
export const mergeTag = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(TagMerge)
  .handler(async ({ data: { sourceId, targetId } }) => {
    const repo = tags(await getDb());
    required(repo.get(sourceId), "tag", sourceId);
    required(repo.get(targetId), "tag", targetId);
    return required(repo.merge(sourceId, targetId), "tag", targetId);
  });
