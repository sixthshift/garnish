/** Why an import did not produce a recipe. The screen shows `message`; the kind is what a test asserts on. */
export type ImportFailure = "unavailable" | "timeout" | "failed" | "malformed";

/**
 * A failed import, carrying which of the four ways it failed: no model is
 * configured, the model took too long, something could not be reached or
 * answered badly, or the answer was not a recipe. Never a partial write:
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
