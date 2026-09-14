// The import module. Its job in one sentence: turn what a source hands over
// into an `ImportedRecipe`, and check it. A source is a web page, a paste, or
// another app's export file; the `Importer` does not care which, and the
// review screen that receives the result does not have to.
//
// This file is the module's whole surface. Everything not exported here is
// internal, and nothing outside `src/domain/import` imports it
// (`test/modules.test.ts` holds that line). Tests of internals live in
// `test/domain/import` and may reach in.

// The importer: build one with a page fetch and a model, hand it a source.
export { Importer, type Ports, type PageResponse } from "./importer";
export { ImportError } from "./errors";

// What it produces.
export type { ImportedRecipe, ImportSource } from "./result";
export type { ScrapedRecipe } from "./scraped";
export type { ImportCheck } from "./check";
export type { FileRecipe, TandoorRecipe } from "./sources/tandoor";
export type { MealieRecipe } from "./sources/mealie";

// Validating an anchor at the server boundary before it is handed back to the importer.
export { ScrapedRecipeSchema } from "./scraped";

// The review screen's face of the module: reading a result and building its rows.
export * as review from "./review";
