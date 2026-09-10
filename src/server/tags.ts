// Tag server functions. Every id lookup that misses raises NotFound.
import { createServerFn } from "@tanstack/react-start";
import { required } from "../db/errors";
import { tags } from "../db/tags";
import { IdInput, ListQuery, NameInput, TagCreate, TagUpdate } from "../domain/reference";
import { getDb } from "./db";
import { notFoundMiddleware } from "./fn";

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
