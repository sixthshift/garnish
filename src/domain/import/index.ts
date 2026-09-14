// The import module. Its job in one sentence: turn what a source hands over
// into an `ImportedRecipe`, and check it. A source is a web page, a paste, or
// another app's export file; the `Importer` does not care which, and the
// review screen that receives the result does not have to.
//
// This file is the module's whole surface. Everything not exported here —
// the JSON-LD and OpenGraph readers, the zip reader, the schema.org field
// parsers, the prompt — is internal, and nothing outside `src/domain/import`
// imports it (`test/modules.test.ts` holds that line). Tests of internals
// live in `test/domain/import` and may reach in.

// The importer: build one with a page fetch and a model, hand it a source.
export { Importer, type Ports, type Source, type PageResponse } from "./importer";
export { ImportError, type ImportFailure } from "./errors";

// What it produces.
export type { ImportedRecipe, ImportSource } from "./result";
export type { ScrapedPart, ScrapedRecipe } from "./scraped";
export type { FileRecipe, TandoorRecipe } from "./sources/tandoor";
export type { ImportFile, MealieRecipe } from "./sources/mealie";
export type { ImportCheck } from "./check";

// The contract as the model is asked for it: the recipe's JSON Schema, for the `model` port's structured output.
export { SCRAPED_JSON_SCHEMA } from "./model";

// For the review screen: reading a result and building its rows.
export { ingredientLines, normaliseScraped, ScrapedPartSchema, ScrapedRecipeSchema } from "./scraped";
export { IMPORT_FIELD, reviewRowsFromMealie } from "./sources/mealie";
export { isTandoorRecipe, reviewRowsFromTandoor } from "./sources/tandoor";
