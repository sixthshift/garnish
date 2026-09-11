// Shared pieces for server functions. Client-safe: nothing here touches bun:sqlite.
//
// TanStack Start's compiler splits a server function out of its module by
// finding the literal chain `createServerFn(...)...handler(fn)` assigned to a
// top-level variable, so `createServerFn` cannot be hidden behind a wrapper.
// Each server function is written in full, with this middleware in the chain:
//
//   export const getRecipe = createServerFn({ method: "GET" })
//     .middleware([notFoundMiddleware])
//     .validator(RecipeIdInput)            // any zod schema; Standard Schema is accepted
//     .handler(async ({ data }) => required(recipes(await getDb()).get(data.id), "recipe", data.id));
//
// A validation failure throws before the handler runs. A thrown NotFound
// becomes TanStack's not-found error, which the client discriminates with
// `isNotFound(error)` and route loaders render through `notFoundComponent`.
import { notFound } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import { isNotFoundError } from "./errors";

/** Data carried on the not-found error a server function throws for a missing row. */
export type NotFoundData = { entity: string; id: string; message: string };

/** Build the router's not-found error for a missing row. Pure; exported for tests. */
export function toNotFound(error: unknown): unknown {
  if (!isNotFoundError(error)) return error;
  const data: NotFoundData = { entity: error.entity, id: error.id, message: error.message };
  return notFound({ data });
}

/** Function middleware: rethrows a repository NotFound as `notFound()`. Everything else passes through. */
export const notFoundMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    throw toNotFound(error);
  }
});
