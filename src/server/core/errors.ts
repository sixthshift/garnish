// Client-safe: no bun:sqlite, so route loaders and components may import it.

/** A row that should exist does not. Server functions map this to TanStack's `notFound()`. */
export class NotFound extends Error {
  override readonly name = "NotFound";

  constructor(
    /** What was looked up, e.g. "recipe". */
    readonly entity: string,
    /** The id or slug that missed. */
    readonly id: string
  ) {
    super(`${entity} ${id} not found`);
  }
}

/** True for a NotFound, including one from another copy of this module. */
export function isNotFoundError(error: unknown): error is NotFound {
  return error instanceof NotFound || (error instanceof Error && error.name === "NotFound");
}

/** Unwrap a repository's `T | null`, throwing NotFound on null. */
export function required<T>(value: T | null | undefined, entity: string, id: string): T {
  if (value === null || value === undefined) throw new NotFound(entity, id);
  return value;
}
