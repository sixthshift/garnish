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

// Start's compiler finds the literal createServerFn(...).handler() chain at top level, so createServerFn cannot be wrapped: each server function writes the chain in full and adds this middleware.
/** Function middleware: rethrows a repository NotFound as `notFound()`. Everything else passes through. */
export const notFoundMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    throw toNotFound(error);
  }
});
