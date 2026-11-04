/** Why an import did not produce a recipe. The screen shows `message`; the kind is what a test asserts on. */
export type ImportFailure = "unavailable" | "timeout" | "failed" | "malformed" | "blocked";

/**
 * A failed import, carrying which of the five ways it failed: no model is
 * configured, the model took too long, something could not be reached or
 * answered badly, the answer was not a recipe, or a site walled off every way
 * this server has of reading it (the fetch, and the browser when there is one). Never a partial write:
 * nothing is written by the importer at all.
 */
export class ImportError extends Error {
  readonly kind: ImportFailure;
  constructor(kind: ImportFailure, message: string) {
    super(message);
    this.name = "ImportError";
    this.kind = kind;
  }
}
